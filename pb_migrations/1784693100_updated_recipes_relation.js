/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("recipes");

  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "relation182938475",
    "name": "ingredient_refs",
    "type": "relation",
    "required": false,
    "presentable": false,
    "system": false,
    "cascadeDelete": false,
    "minSelect": null,
    "maxSelect": null,
    "collectionId": "pbc_ingredients_pool"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("recipes");
  collection.fields.removeById("relation182938475");
  return app.save(collection);
});
