/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_842702175")

  collection.fields.addAt(12, new Field({
    "help": "",
    "hidden": false,
    "id": "num_cal_density",
    "max": null,
    "min": null,
    "name": "calorie_density",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_842702175")

  collection.fields.removeById("num_cal_density")

  return app.save(collection)
})
