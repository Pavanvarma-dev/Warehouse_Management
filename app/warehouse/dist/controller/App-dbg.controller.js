sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, MessageBox, MessageToast) {
    "use strict";

    const TABLE_IDS = [
        "warehousesTable",
        "binsTable",
        "productsTable",
        "stockTable",
        "movementsTable"
    ];

    const SEARCH_FIELDS = {
        warehouses: ["name", "code", "Location"],
        bins: ["binCode", "aisel", "warehouse/name"],
        products: ["sku", "name", "category"],
        stock: ["product/name", "product/sku", "bin/binCode"],
        movements: ["product/name", "fromBin/binCode", "toBin/binCode"]
    };

    return Controller.extend("com.warehouse.warehouse.controller.App", {
        onTabSelect: function (event) {
            this.getView().getModel("ui").setProperty(
                "/selectedTab",
                event.getParameter("key")
            );
        },

        onRefresh: function () {
            this._refreshAll();
            MessageToast.show("warehouseeee data refreshed.");
        },

        onSearch: function (event) {
            const key = this.getView().getModel("ui").getProperty("/selectedTab");
            const table = this._getActiveTable();
            const binding = table && table.getBinding("items");
            const query = event.getParameter("newValue").trim();

            if (!binding) {
                return;
            }

            const fields = SEARCH_FIELDS[key] || [];
            binding.filter(query ? new Filter({
                filters: fields.map(function (field) {
                    return new Filter(field, FilterOperator.Contains, query);
                }),
                and: false
            }) : []);
        },

        onAddWarehouse: function () {
            this._openDialog("warehouse", "Add Warehouse");
        },

        onAddBin: function () {
            this._openDialog("bin", "Add Storage Bin");
        },

        onAddProduct: function () {
            this._openDialog("product", "Add Product");
        },

        onReceiveStock: function () {
            this._openDialog("receive", "Receive Stock");
        },

        onDispatchStock: function () {
            this._openDialog("dispatch", "Dispatch Stock");
        },

        onCancelDialog: function () {
            this.byId("editDialog").close();
        },


onClearLowStockAlerts: function () {

    const oView = this.getView();
    const oModel = oView.getModel();

    sap.m.MessageBox.confirm(
        "Are you sure you want to delete all low-stock alerts?",
        {
            title: "Clear Alerts",

            onClose: async (sAction) => {

                if (sAction !== sap.m.MessageBox.Action.OK) {
                    return;
                }

                try {

                    const oOperation = oModel.bindContext(
                        "/clearLowStockAlerts(...)"
                    );

                    await oOperation.execute();

                    // Refresh alerts list
                    this._refreshLowStockAlerts();

                    sap.m.MessageToast.show(
                        "All alerts cleared successfully"
                    );

                } catch (error) {

                    console.error("Clear alerts error:", error);

                    sap.m.MessageBox.error(
                        "Unable to clear alerts."
                    );
                }
            }
        }
    );
},

_refreshLowStockAlerts: function () {

    const oList = this.byId("lowStockAlerts");

    // Check whether List exists
    if (!oList) {
        console.error("Low Stock Alerts List not found!");
        return;
    }

    const oBinding = oList.getBinding("items");
    console.log("alert binding", oBinding);

    // Check whether binding exists
    if (!oBinding) {
        console.error("Low Stock Alerts binding not found!");
        return;
    }

    oBinding.refresh();

    console.log("Low Stock Alerts refreshed successfully");
},


        onSaveDialog: async function () {
            const uiModel = this.getView().getModel("ui");
            const type = uiModel.getProperty("/dialogType");
            const form = uiModel.getProperty("/form");

            try {
                if (type === "warehouse") {
                    this._requireText(form.name, "Name");
                    this._requireText(form.code, "Code");
                    this._requireText(form.Location, "Location");
                    await this._create("Warehouse", {
                        name: form.name.trim(),
                        code: form.code.trim(),
                        Location: form.Location.trim()
                    });
                } else if (type === "bin") {
                    this._requireText(form.binCode, "Bin code");
                    this._requireText(form.aisel, "Aisle");
                    this._requireText(form.warehouse_ID, "Warehouse");
                  await this._create("StorageBins", {
                        binCode: form.binCode.trim(),
                        aisel: form.aisel.trim(),
                        maxCapacity: this._requirePositiveInteger(form.maxCapacity, "Maximum capacity"),
                        warehouse_ID: form.warehouse_ID
                    });                
                } else if (type === "product") {
                    this._requireText(form.sku, "SKU");
                    this._requireText(form.name, "Name");
                    this._requireText(form.category, "Category");
                    this._requireText(form.unitOfMeasure, "Unit of measure");
                    await this._create("Products", {
                        sku: form.sku.trim(),
                        name: form.name.trim(),
                        category: form.category.trim(),
                        unitPrice: this._requireNonNegativeNumber(form.unitPrice, "Unit price"),
                        unitOfMeasure: form.unitOfMeasure.trim()
                    });
                } else if (type === "receive" || type === "dispatch") {
                    this._requireText(form.productId, "Product");
                    this._requireText(form.binId, "Storage bin");
                    await this._runStockAction(type, {
                        productId: form.productId,
                        binId: form.binId,
                        quantity: this._requirePositiveInteger(form.quantity, "Quantity")
                    });
                } else {
                    throw new Error("Choose a supported warehouse operation.");
                }

                this.byId("editDialog").close();
                uiModel.setProperty("/status", "Operation completed successfully.");
                MessageToast.show("Operation completed successfully.");
                this._refreshAll();
            } catch (error) {
                MessageBox.error(error.message || "The operation could not be completed.");
            }
        },

        _openDialog: function (type, title) {
            const uiModel = this.getView().getModel("ui");
            uiModel.setProperty("/dialogType", type);
            uiModel.setProperty("/dialogTitle", title);
            uiModel.setProperty("/form", {});
            this.byId("editDialog").open();
        },

        _create: async function (entitySet, data) {
            const listBinding = this.getView().getModel().bindList("/" + entitySet);
            await listBinding.create(data).created();
        },

        _runStockAction: async function (type, data) {
            const action = type === "receive" ? "recieveStock" : "dispatchStock";
            const operation = this.getView().getModel().bindContext("/" + action + "(...)");
            operation.setParameter("productId", data.productId);
            operation.setParameter("binId", data.binId);
            operation.setParameter("quantity", data.quantity);
            await operation.execute();

            this._refreshLowStockAlerts();
        },

        _refreshAll: function () {
            const view = this.getView();
            TABLE_IDS.forEach(function (id) {
                const table = view.byId(id);
                const binding = table && table.getBinding("items");
                if (binding) {
                    binding.refresh();
                }
            });
        },

        _getActiveTable: function () {
            const key = this.getView().getModel("ui").getProperty("/selectedTab");
            const tableByKey = {
                warehouses: "warehousesTable",
                bins: "binsTable",
                products: "productsTable",
                stock: "stockTable",
                movements: "movementsTable"
            };
            return this.byId(tableByKey[key]);
        },

        _requireText: function (value, label) {
            if (typeof value !== "string" || value.trim() === "") {
                throw new Error(label + " is required.");
            }
        },

        _requirePositiveInteger: function (value, label) {
            const number = Number(value);
            if (!Number.isInteger(number) || number <= 0) {
                throw new Error(label + " must be a positive whole number.");
            }
            return number;
        },

        _requireNonNegativeNumber: function (value, label) {
            const number = Number(value);
            if (!Number.isFinite(number) || number < 0) {
                throw new Error(label + " must be zero or greater.");
            }
            return number;
        }
    });
});
