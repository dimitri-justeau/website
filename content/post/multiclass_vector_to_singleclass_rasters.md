+++
tags = []
description = ""
draft = false
title = "Converting multi-class vector dataset to multiple single-class presence-absence raster datasets, with GeoPandas and Rasterio"
mathjax = true
author = "Dimitri Justeau"
comment = false
categories = []
keywords = []
date = "2018-05-14T17:27:57+02:00"
reward = false
contentCopyright = false
toc = false

+++

In this post we will see how to convert a single shapefile containing vector features of several classes (where the class is stored as an attribute of the features) to multiple single-class presence-absence rasters, one for each class. More concretely, we have one shapefile containing a bunch of vector features, representing many classes. For each class, we want to extract one single band presence-absence raster, that is a raster where a pixel equals 1 if there is an vector of this class overlapping it, 0 else.

A typical use case is to have a shapefile containing many species occurrences (point features) and extract a presence-absence raster for each species. We illustrate the process with such an example: occurrences of 3 different species in New-Caledonia.

To achieve this task we rely on the [Python 3](https://www.python.org/) programming language (note that the same can be achieved with Python 2) and the [GeoPandas](https://github.com/geopandas/geopandas) and [Rasterio](https://github.com/mapbox/rasterio) libraries. GeoPandas is a geospatial extension of the [Pandas](https://pandas.pydata.org/) data analysis library which allows the manipulation of vector data. On the other hand, Rasterio is mainly based on the [GDAL](http://www.gdal.org/) library and provides an Python API to read, manipulate and write raster data through [NumPy](http://www.numpy.org/) N-dimensional arrays.

### 1 - Read the occurrence shapefile with GeoPandas

Our first step consists in reading the shapefile with GeoPandas, which is quite straightforward: we import the library and store the content of the shapefile into a DataFrame with the [`read_file`](http://geopandas.readthedocs.io/en/latest/reference/geopandas.read_file.html) function.

```python
import geopandas as gpd
features = gpd.read_file("path_to_the_shapefile")
class_column = "species_id"
```

Below is the DataFrame that we get with our example dataset:

| id| species_id | geometry                                    |
|---|------------|---------------------------------------------|
|  0|           1| POINT (164.6773504277914 -20.69403200188892)|
|  1|           1| POINT (165.1705275154343 -21.06129153524009)|
|  2|           1| POINT (165.4853214011639 -21.51249610478582)|
|  3|           1| POINT (164.9291855363749 -21.06129153524009)|
|  4|           1| POINT (164.3625565420617 -20.33726559806206)|
|  5|           1| POINT (165.9260328411853 -21.58594801145605)|
|  6|           1| POINT (165.1390481268613 -21.17671596000761)|
|  7|           2| POINT (165.0131305725695 -20.87241520380234)|
|  8|           2|  POINT (164.8032679820831 -20.9563602399969)|
|  9|           2| POINT (165.4013763649693 -21.35509916192103)|
| 10|           2| POINT (165.8525809345151 -21.76433121336948)|
| 11|           2| POINT (166.7654832031308 -22.14208387624497)|
| 12|           3| POINT (166.2618129859635 -21.60693427050469)|
| 13|           3| POINT (166.1778679497689 -21.69087930669925)|
| 14|           3| POINT (168.0771243936707 -21.53348236383446)|
| 15|           3| POINT (167.1747152545793 -20.72551139046188)|
| 16|           3| POINT (166.4297030583526 -22.12109761719634)|

**Note:** The unit of the coordinates and any induced measure depends on the dataset's Coordinate Reference System (CRS). In our case, we encoded our occurrences locations using *WGS84*, our data is thus expressed in degrees.

### 2 - Define the bounding box and the output resolution

We want our output rasters to cover a certain geographical extent (more or less 1 pixel), which is usually called the *bounding box*. A bounding box is tuple of 4 values, \\((x\_{min}, y\_{min}, x\_{max}, y\_{max})\\). In the case of geographic data, \\(x\_{min}\\) and \\(x\_{max}\\) are the *west* and *east* longitudes, and \\(y\_{min}\\) and \\(y\_{max}\\) are the *south* and *north* latitudes. Here, we define our bounding box such that it covers New Caledonia's boundaries: `(163.5423, -22.6963, 168.1895, -19.535)`. [Here](https://boundingbox.klokantech.com/) is a nice online tool for defining a bounding box. 

From the bounding box, We can define the output resolution \\(\text{pixel_width} \times \text{pixel_height}\\), that is the dimension of the output rasters pixels, in the CRS unit (we want square pixels in this example, so \\(\text{pixel_width} = \text{pixel_height}\\)). For instance, if we want \\(n\_{cols}\\) columns, we compute the resolution as \\(\text{pixel_width} = (x\_{max} - x\_{min}) / n\_{cols}\\), we then compute the number of rows as \\(n\_{rows} = \lceil(y\_{max} - y\_{min}) / \text{pixel_width}\rceil\\). \\(\lceil x \rceil\\) means the ceiling of \\(x\\), that is the smallest integer greater than or equal to \\(x\\), we use it to ensure that the whole bounding box will be included in our rasters. Note that we could also define the number of columns and rows and compute the resolution, but we would end with rectangular pixels (which can be desired in some cases).

```python
import math
x_min, y_min, x_max, y_max = 163.5423, -22.6963, 168.1895, -19.535
n_cols = 600
pixel_width = pixel_height = (x_max - x_min) / n_cols
n_rows = math.ceil((y_max - y_min) / pixel_width)
```

### 3 - Define the affine transformation

The affine transformation is a tool from matrix algebra that allows the transformation between classical raster grid coordinates and geographical coordinates. [This article](https://www.perrygeo.com/python-affine-transforms.html) provides a quick explanation of what are affine transformations and how to use them with Python.

```python
from affine import Affine
affine = Affine(pixel_width, 0, x_min, 0, -pixel_height, y_max)
```

### 4 - Iterate over the species ids and rasterize the corresponding features with Rasterio

We now have everything we need for generating our output rasters. First, we iterate over the classes (obtained in *line 4*). Then, for each class (*line 15*), we extract the corresponding features (*line 16*). We create a list of couples from the geometries, each couple containing the geometry and the value 1 (*line 17*). This value is the one that will be given to the pixels overlapping the corresponding geometry. We then use the [`rasterize`](http://rasterio.readthedocs.io/en/latest/api/rasterio.features.html#rasterio.features.rasterize) function from `rasterio.features` to generate a \\(n\_{rows} \times n\_{cols}\\) NumPy ndarray (*lines 19\-24*). We finaly store this array in a 1-band raster file, using the [`open`](http://rasterio.readthedocs.io/en/latest/api/rasterio.html#rasterio.open) function of Rasterio (*lines 25\-26*).

```python
import os
import rasterio
import rasterio.features
classes = features[class_column].unique()
output_base_path = "base_path_of_the_output_rasters"
out_meta = {
    'width': n_cols, 
    'height': n_rows, 
    'transform': affine, 
    'crs': features.crs, 
    'driver': "GTiff", 
    'count': 1, 
    'dtype': rasterio.int16
}
for class_value in classes:
    feats = features[features[class_column] == class_value]
    shapes = [(geom, 1) for geom in feats.geometry]
    output_path = os.path.join(output_base_path, "{}.tif".format(class_value))
    rasterized = rasterio.features.rasterize(
        shapes=shapes,
        out_shape=(out_meta['height'], out_meta['width']),
        dtype=out_meta['dtype'],
        transform=out_meta['transform']
    )
    with rasterio.open(output_path, 'w', **out_meta) as out:
        out.write_band(1, rasterized)
```

### 5 - Putting all together into a generic function

The whole process can be encapsulated into a generic python function, that can also be used as a command line function. Below is the code of such a generic function. You can also find it on this [gist](https://gist.github.com/dimitri-justeau/20f256086cb153e32213a2c03c1d1327), with a command-line enabled version.

```python
import os
import math

import geopandas as gpd
import rasterio
import rasterio.features
from affine import Affine

def multiclass_vector_to_singleclass_rasters(input_vector, class_column,
                                             bounding_box, output_base_path,
                                             pixel_size=None, n_cols=None,
                                             n_rows=None, file_prefix='',
                                             file_suffix='',
                                             all_touched=False):
    # Load the features
    features = gpd.read_file(input_vector)
    # Compute resolution
    x_min, y_min, x_max, y_max = bounding_box
    # - Case 1: pixel size is directly given
    if pixel_size is not None:
        if isinstance(pixel_size, (list, tuple)) and len(pixel_size) >= 2:
            pixel_width = pixel_size[0]
            pixel_height = pixel_size[1]
        elif isinstance(pixel_size, (int, float)):
            pixel_width = pixel_size
            pixel_height = pixel_size
        else:
            raise TypeError()
        n_rows = math.ceil((y_max - y_min) / pixel_height)
        n_cols = math.ceil((x_max - x_min) / pixel_width)
    # - Case 2: pixel size determined from the number of columns and/or rows
    elif n_cols is not None:
        if n_rows is not None:
            # - Case 2.1: from number of columns and rows
            pixel_width = (x_max - x_min) / n_cols
            pixel_height = (y_max - y_min) / n_rows
        else:
            # - Case 2.2: from number of columns only (compute n_rows)
            pixel_width = (x_max - x_min) / n_cols
            pixel_height = pixel_width
            n_rows = math.ceil((y_max - y_min) / pixel_width)
    elif n_rows is not None:
        # - Case 2.3: from number of rows only (compute n_cols)
        pixel_height = (y_max - y_min) / n_rows
        pixel_width = pixel_height
        n_cols = math.ceil((x_max - x_min) / pixel_height)
    else:
        raise TypeError()
    # Define the affine transformation
    affine = Affine(pixel_width, 0, x_min, 0, -pixel_height, y_max)
    # Generate the rasters
    out_meta = {
        'width': n_cols,
        'height': n_rows,
        'transform': affine,
        'crs': features.crs,
        'driver': 'GTiff',
        'count': 1,
        'dtype': rasterio.int16
    }
    classes = features[class_column].unique()
    for class_value in classes:
        feats = features[features[class_column] == class_value]
        shapes = [(geom, 1) for geom in feats.geometry]
        file_name = "{}{}{}.tif".format(file_prefix, class_value, file_suffix)
        if not os.path.exists(output_base_path):
            os.makedirs(output_base_path)
        output_path = os.path.join(output_base_path, file_name)
        rasterized = rasterio.features.rasterize(
            shapes=shapes,
            out_shape=(out_meta['height'], out_meta['width']),
            dtype=out_meta['dtype'],
            transform=out_meta['transform'],
            all_touched=all_touched
        )
        with rasterio.open(output_path, 'w', **out_meta) as out:
            out.write_band(1, rasterized)

```