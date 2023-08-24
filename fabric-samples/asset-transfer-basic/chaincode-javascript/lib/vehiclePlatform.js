/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";
// Deterministic JSON.stringify()
const stringify = require("json-stringify-deterministic");
const sortKeysRecursive = require("sort-keys-recursive");
const { Contract } = require("fabric-contract-api");

class VehiclePlatform extends Contract {
  async InitLedger(ctx) {
    const vehicles = [
      {
        ID: "org1_1",
        Org: "Org1",
        Latitude: 35.6453,
        Longitude: 128.4253,
        Battery: 83,
        IsUsing: false,
        User: null,
      },
      {
        ID: "org1_2",
        Org: "Org1",
        Latitude: 35.6443,
        Longitude: 128.4553,
        Battery: 43,
        IsUsing: false,
        User: null,
      },
      {
        ID: "org1_3",
        Org: "Org1",
        Latitude: 35.6413,
        Longitude: 128.4953,
        Battery: 23,
        IsUsing: false,
        User: null,
      },
      {
        ID: "org2_1",
        Org: "Org2",
        Latitude: 35.1453,
        Longitude: 128.3253,
        Battery: 95,
        IsUsing: false,
        User: null,
      },
      {
        ID: "org2_2",
        Org: "Org2",
        Latitude: 35.1553,
        Longitude: 128.3453,
        Battery: 100,
        IsUsing: false,
        User: null,
      },
      {
        ID: "org2_3",
        Org: "Org2",
        Latitude: 35.1153,
        Longitude: 128.3153,
        Battery: 43,
        IsUsing: false,
        User: null,
      },
    ];

    for (const vehicle of vehicles) {
      vehicle.docType = "vehicle";
      // example of how to write to world state deterministically
      // use convetion of alphabetic order
      // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
      // when retrieving data, in any lang, the order of data will be the same and consequently also the corresonding hash
      await ctx.stub.putState(
        vehicle.ID,
        Buffer.from(stringify(sortKeysRecursive(vehicle)))
      );
    }
  }

  // CreateAsset issues a new asset to the world state with given details.
  async CreateVehicle(ctx, id, org) {
    const exists = await this.VehicleExists(ctx, id);
    if (exists) {
      throw new Error(`The asset ${id} already exists`);
    }

    const vehicle = {
      ID: id,
      Org: org,
      Latitude: 0,
      Longitude: 0,
      Battery: 100,
      IsUsing: false,
      User: null,
    };
    // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(vehicle)))
    );
    return JSON.stringify(vehicle);
  }

  // ReadAsset returns the asset stored in the world state with given id.
  async ReadVehicle(ctx, id) {
    const vehicleJSON = await ctx.stub.getState(id); // get the asset from chaincode state
    if (!vehicleJSON || vehicleJSON.length === 0) {
      throw new Error(`The vehicle ${id} does not exist`);
    }
    return vehicleJSON.toString();
  }

  // UpdateAsset updates an existing asset in the world state with provided parameters.
  async UpdateAsset(ctx, id, org, latitute, longitude, battery, isUsing, user) {
    const exists = await this.VehicleExists(ctx, id);
    if (!exists) {
      throw new Error(`The asset ${id} does not exist`);
    }

    // overwriting original asset with new asset
    const updatedVehicle = {
      ID: id,
      Org: org,
      Latitude: latitute,
      Longitude: longitude,
      Battery: battery,
      IsUsing: isUsing,
      User: user,
    };
    // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    return ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(updatedVehicle)))
    );
  }

  // DeleteAsset deletes an given asset from the world state.
  async DeleteAsset(ctx, id) {
    const exists = await this.VehicleExists(ctx, id);
    if (!exists) {
      throw new Error(`The asset ${id} does not exist`);
    }
    return ctx.stub.deleteState(id);
  }

  // AssetExists returns true when asset with given ID exists in world state.
  async VehicleExists(ctx, id) {
    const vehicleJSON = await ctx.stub.getState(id);
    return vehicleJSON && vehicleJSON.length > 0;
  }

  // TransferAsset updates the owner field of asset with given id in the world state.
  async TransferAsset(ctx, id, newOwner) {
    const vehicleString = await this.ReadVehicle(ctx, id);
    const vehicle = JSON.parse(vehicleString);
    const oldOwner = asset.Owner;
    asset.Owner = newOwner;
    // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(asset)))
    );
    return oldOwner;
  }

  async UseVehicle(ctx, id, user) {
    const vehicleString = await this.ReadVehicle(ctx, id);
    const vehicle = JSON.parse(vehicleString);
    vehicle.IsUsing = true;
    vehicle.User = user;
    await ctx.stub.putState(
      id,
      Buffer.from(stringify(sortKeysRecursive(vehicle)))
    );
    return vehicle;
  }

  // GetAllAssets returns all assets found in the world state.
  async GetAllVehicles(ctx) {
    const allResults = [];
    // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
    const iterator = await ctx.stub.getStateByRange("", "");
    let result = await iterator.next();
    while (!result.done) {
      const strValue = Buffer.from(result.value.value.toString()).toString(
        "utf8"
      );
      let record;
      try {
        record = JSON.parse(strValue);
      } catch (err) {
        console.log(err);
        record = strValue;
      }
      allResults.push(record);
      result = await iterator.next();
    }
    return JSON.stringify(allResults);
  }
}

module.exports = VehiclePlatform;
