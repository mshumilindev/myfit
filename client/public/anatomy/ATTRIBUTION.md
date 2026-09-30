# Anatomy layers

2D projections of the BodyParts3D 4.0 model (bones, spine, organs).
© The Database Center for Life Science (DBCLS), licensed CC BY 4.0
(https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html).
Mitsuhashi et al. (2009), BodyParts3D: 3D structure database for anatomical
concepts, Nucleic Acids Res. https://doi.org/10.1093/nar/gkn613

Meshes were taken from the packed copy in github.com/ctzurcanu/human-atlas
(public/models/atlas.json, data licensed CC BY 4.0), orthographically rendered
(front / back / left and 24 turntable angles), converted to WebP; lung silhouettes are a dilation of the
bronchial trees. Files named `<layer>.<view>.webp`; region layers are white masks
tinted in the app with a tone colour.

`turn/<layer>/<deg>.webp`: the same layers orthographically rendered every 5° around the
vertical axis (0° = front, 90° = the person's left, 180° = back), 320×700, for the drag-to-rotate map.
