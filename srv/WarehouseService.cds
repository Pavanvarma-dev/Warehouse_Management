using{Warehouse as my} from '../db/schema';

@requires: 'authenticated-user'
service WarehouseService @(path:'/warehouse') {

    @restrict:[
        {
            grant:'READ',
            to:'warehouse_operator',
            where: 'Warehouse_ID = $user.Warehouse_ID'
        },
        {
            grant:'*',
            to:['warehouse_manager','admin']
        }
    ]
    entity Warehouse as projection on my.Warehouse{
        ID,
        name,
        code,
        Location,
        bins
    };

    entity StorageBins as projection on my.StorageBins {
        ID,
        binCode,
        aisel,
        maxCapacity,
        remainingCapacity,
        warehouse
    };

    type ExchangeRateResult {
    baseCurrency   : String(3);
    targetCurrency : String(3);
    rate          : Decimal(15,6);
}

    entity Products as projection on my.Products;
    entity BinStocks as projection on my.BinStocks;
    entity StockMovements as projection on my.StockMovements;
    entity LowStockAlert as projection on my.LowStockAlert;

    action recieveStock(productId:UUID, binId:UUID, quantity:Integer) returns StockMovements;
    action dispatchStock(productId:UUID, binId:UUID, quantity:Integer) returns StockMovements;
    action clearLowStockAlerts();
    action getExchangeRate(currency: String(3)) returns ExchangeRateResult ;

    event stockRecieved{
        productId:UUID;
        binId:UUID;
        quantity:Integer;
    }

}
