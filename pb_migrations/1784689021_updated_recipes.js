/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_842702175")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "[a-z0-9]{15}",
    "help": "",
    "hidden": false,
    "id": "text3332024192",
    "max": 15,
    "min": 15,
    "name": "id_copy",
    "pattern": "^[a-z0-9]+$",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text2862495610",
    "max": 0,
    "min": 0,
    "name": "date",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_842702175")

  // remove field
  collection.fields.removeById("text3332024192")

  // remove field
  collection.fields.removeById("text2862495610")

  return app.save(collection)
})
