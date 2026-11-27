const cds = require('@sap/cds');
const { message } = require('@sap/cds/lib/log/cds-error');
const { SELECT } = require('@sap/cds/lib/ql/cds-ql');

module.exports = cds.service.impl(async function () {

    const { Warehouse, Products, StorageBins, BinStocks, LowStockAlert } = this.entities;

    this.on('clearLowStockAlerts', async (req) => {
        await cds.tx(req).run(cds.ql.DELETE.from(LowStockAlert));
    });


    this.on('CREATE',Products, async (req) => {
        const { sku, name, category, unitPrice, unitOfMeasure } = req.data;
        const product = await INSERT.into(Products).entries({ sku, name, category, unitPrice, unitOfMeasure });
    });



    this.on('CREATE', Warehouse, async (req) => {
        const { name,code, Location } = req.data;
        const warehouse = await INSERT.into(Warehouse).entries({ name,code,Location });
    });


    this.before('CREATE', StorageBins, async (req) => {
        const { binCode, aisel, maxCapacity, warehouse_ID } = req.data;
         if(!binCode || !aisel || !maxCapacity || !warehouse_ID) {
            req.error(400, 'Missing required fields: binCode, aisel, maxCapacity, or warehouse_ID');
        }
        const warehouse = await SELECT.one.from(Warehouse).where({ ID: warehouse_ID });

        // console.log('Warehouse:', warehouse);

        if(!warehouse) {
            req.error(404, 'Warehouse not found');
        }

    });

    this.on('CREATE', StorageBins, async (req) => {
        const { binCode, aisel, maxCapacity, warehouse_ID } = req.data;
        const storageBin = await INSERT.into(StorageBins).entries({ binCode, aisel, maxCapacity, warehouse: { ID: warehouse_ID } });
    });


    this.before('CREATE', BinStocks, async (req) => {
        const { bin_ID, product_ID, quantity } = req.data;
        const bin = await SELECT.one.from(StorageBins).where({ ID: bin_ID });
        const product = await SELECT.one.from(Products).where({ ID: product_ID });

        if(!bin  || !product) {
            req.error(404, 'One or more referenced entities not found');
        }
    });


    this.on('CREATE', BinStocks, async (req) => {
        const { bin_ID, product_ID, quantity } = req.data;
        const binStock = await INSERT.into(BinStocks).entries({ bin_ID , product_ID , quantity });
        return req.info(`Created bin stock for product ${product_ID} in bin ${bin_ID}. Quantity: ${quantity}`);
    });


this.after('READ', StorageBins, async (bins) => {

        if (!bins) return;

        // Handle both single-bin and multiple-bin responses
        const binList = Array.isArray(bins) ? bins : [bins];
        const binIds = binList.map(bin => bin.ID);

        // Get total quantity of all products in each bin
        const stocks = await SELECT.from(BinStocks)
            .columns(
                'bin_ID',
                {
                    func: 'sum',
                    args: [{ ref: ['quantity'] }],
                    as: 'totalQuantity'
                }
            )
            .where({ bin_ID: { in: binIds } })
            .groupBy('bin_ID');

        // Calculate remaining capacity
        for (const bin of binList) {

            const stock = stocks.find(
                item => item.bin_ID === bin.ID
            );

            const totalQuantity = Number(stock?.totalQuantity || 0);

            bin.remainingCapacity =
                bin.maxCapacity - totalQuantity;
        }
    });


    this.before('recieveStock', async (req) => {
        const { binId, productId, quantity } = req.data;

        if(!binId || !productId || !quantity) {
            req.error(400, 'Missing required fields: binId, productId, or quantity');
        }

        if (quantity <= 0) {
            req.error(400, 'Quantity must be greater than zero');
        }
        
        const product = await SELECT.one.from(Products).where({ID:productId});
        if(!product) {
            req.error(404, 'Product not found');
        }
        const bin = await SELECT.one.from(StorageBins).where({ID:binId});
        // console.log('Bin:', bin);
        if(!bin) {
            req.error(404, 'Storage Bin not found');
        }
        const binCapacity = bin.maxCapacity;

        if (quantity > binCapacity) {
            req.error(400, 'Quantity exceeds bin capacity');
        }
        else{
            const remainingCapacity = binCapacity - quantity;
            if (remainingCapacity <= 0) {
                req.error(400, 'Not enough capacity in the bin');
            }
        }


    });

    this.on('recieveStock', async (req) => {

    const { binId, productId, quantity } = req.data;
            const tx = cds.tx(req);


    // Validate quantity
    if (!Number.isInteger(quantity) || quantity <= 0) {
        return req.error(400, 'Quantity must be greater than zero');
    }

    // Find bin
    const bin = await SELECT.one.from(StorageBins)
        .where({ ID: binId });

    if (!bin) {
        return req.error(404, 'Bin not found');
    }

    // Find existing stock
    const binStock = await SELECT.one.from(BinStocks)
        .where({
            bin_ID: binId,
            product_ID: productId
        });

    const currentQuantity = binStock ? binStock.quantity : 0;

    // Calculate remaining capacity
    const remainingCapacity = bin.maxCapacity - currentQuantity;
    // console.log("remaining Quantity",remainingCapacity)

    // Validate capacity
    if (quantity > remainingCapacity) {
        return req.error(400, 'Quantity exceeds remaining bin capacity');
    }

    if (binStock) {

        // Update existing stock
        const newQuantity = currentQuantity + quantity;

        await tx.run(UPDATE(BinStocks)
            .set({ quantity: newQuantity })
            .where({
                bin_ID: binId,
                product_ID: productId
            }));

    } else {

        // Create new stock
        await tx.run(INSERT.into(BinStocks).entries({
            bin_ID: binId,
            product_ID: productId,
            quantity
        }));

    }

    // publish Event

    await this.emit('StockRecieved',{
        productId,
        binId,
        quantity

    })


    });

    this.on('StockRecieved',async(message) =>{
        const {productId,binId,quantity} = message.data

        const product = await SELECT.one.from(Products).where({ ID: productId });
        const binStock = await SELECT.one.from(BinStocks)
        .where({
            bin_ID: binId,
            product_ID: productId
        });

        const presentQuantity = binStock.quantity
        const newStock = quantity+presentQuantity
        console.log("from new stock", newStock)

        if (newStock > 500){
            const alert = await SELECT.from(LowStockAlert).where({
            product_ID: productId,
            bin_ID: binId
        })
        console.log("from alert delete",alert)
        if(alert){ 
            DELETE.from(LowStockAlert)
            .where({
            product_ID: productId,
            bin_ID: binId
            })
        console.log("Stock alert has been deleted from alert")
        }
        }              
    })

    this.on('dispatchStock', async (req) => {

    const { binId, productId, quantity } = req.data;
    const tx = cds.tx(req);

    // 1. Validate quantity
    if (!Number.isInteger(quantity) || quantity <= 0) {
        return req.error(400, 'Dispatch quantity must be greater than zero');
    }

    // 2. Check bin exists
    const bin = await SELECT.one.from(StorageBins)
        .where({ ID: binId });

    if (!bin) {
        return req.error(404, 'Storage bin not found');
    }

    // 3. Find product stock in the bin
    const binStock = await tx.run(SELECT.one.from(BinStocks)
        .where({
            bin_ID: binId,
            product_ID: productId
        }));

    if (!binStock) {
        return req.error(404, 'Product stock not found in this bin');
    }

    // 4. Validate available stock
    if (quantity > binStock.quantity) {
        return req.error(400, 'Insufficient stock for dispatch');
    }

    // 5. Calculate remaining stock
    const remainingStock = binStock.quantity - quantity;

    // 6. Update stock
    await UPDATE(BinStocks)
        .set({
            quantity: remainingStock
        })
        .where({
            ID: binStock.ID
        });

    await this.emit('StockDeducted',{
        productId,
        binId,
        quantity

    })

});

 this.on('StockDeducted',async(message) =>{
        const {productId,binId,quantity} = message.data
        const product = await SELECT.one.from(Products).where({ ID: productId });
        const binStock = await SELECT.one.from(BinStocks)
        .where({
            bin_ID: binId,
            product_ID: productId
        });

        const presentQuantity = binStock.quantity
         if(presentQuantity < 500){
             await INSERT.into(LowStockAlert).entries({
                 bin: { ID: binId },
                 product: { ID: productId }, 
                 quantity:presentQuantity,
                 message:` LoW stock Alert -- ${product.name} have Low Stock of ${presentQuantity} units`,
                 isRead:true
                })
                console.log(` LoW stock Alert -- ${product.name} have Low Stock of ${presentQuantity} units`); 
                
    }

    })
        
        
    this.on ('Stockdeducted',async(message) =>{
        const {productId,binId} = message.data
        
        const product = await SELECT.one.from(Products).where({ ID: productId });
        const binStock = await SELECT.one.from(BinStocks)
        .where({
            bin_ID: binId,
            product_ID: productId
        });

        const presentQuantity = binStock.quantity

        if(presentQuantity < 500){
        }
        if(presentQuantity < 500)
        console.log(` LoW stock Alert -- ${product.name} have Low Stock of ${presentQuantity} units  from the 2 stokckdeduted`);        
    })

    this.on('getExchangeRate',async(req) =>{
        const{currency} = req.data

        try {

            const response = await fetch(
                `https://open.er-api.com/v6/latest/USD`
            );

            if(! response.ok){
                return req.error("Something went wrong in External API")
            }
            const result = await response.json();
            const rates = result.rates[currency]

            if(!rates){
                return req.error("Your currency is not supported");
            }

            return {
                baseCurrency:"USD",
                targetCurrency:currency,
                rate:rates
            };
            
        } catch (error) {
            console.log("External API Error", Error.message)
            return req.error("External aPi Error");
            
        }
    })

});