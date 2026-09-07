/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_ingredients_pool")

  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "json_aliases_01",
    "maxSize": 0,
    "name": "aliases",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text_icon_0001",
    "max": 50,
    "min": 0,
    "name": "icon",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "num_calories_1",
    "max": null,
    "min": null,
    "name": "calories_per_100g",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "json_unit_weight",
    "maxSize": 0,
    "name": "unit_weight",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "bool_is_condim",
    "name": "is_condiment",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_ingredients_pool")

  collection.fields.removeById("json_aliases_01")
  collection.fields.removeById("text_icon_0001")
  collection.fields.removeById("num_calories_1")
  collection.fields.removeById("json_unit_weight")
  collection.fields.removeById("bool_is_condim")

  return app.save(collection)
})
