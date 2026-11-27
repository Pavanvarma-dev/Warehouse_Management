namespace Warehouse;

using{managed, cuid} from '@sap/cds/common';

entity Warehouse : cuid, managed {
    name  : String(111)@mandatory;
    code  : String(111)@mandatory;
    Location: String(255)@mandatory;

        bins : Association to many StorageBins
        on bins.warehouse = $self;
}
entity StorageBins : cuid, managed {
    binCode  : String(111);
    aisel: String(111);
    maxCapacity : Integer @assert.range:[1, 10000];

    virtual remainingCapacity: Integer;


    warehouse : Association to Warehouse;
    stocks : Association to many BinStocks  on stocks.bin = $self;
}

entity Products:cuid {
    sku : String(111)@mandatory;
    name  : String(111) @mandatory;
    category  : String(111)@mandatory;
    unitPrice : Decimal(10, 2)@assert.range: [(0), _]@mandatory;
    unitOfMeasure : String(20)@mandatory;
}

entity BinStocks : cuid, managed {
    bin : Association to StorageBins @mandatory;
    product : Association to Products @mandatory;
    quantity : Integer @assert.range:[1, 1000];
}

entity StockMovements : cuid, managed {
    product : Association to Products;
    fromBin : Association to StorageBins;
    toBin : Association to StorageBins;
    quantity : Integer;
    movementDate : DateTime;
}

entity LowStockAlert : cuid, managed {

    bin : Association to StorageBins @mandatory;
    product : Association to Products @mandatory;
    quantity : Integer @assert.range:[1, 1000];
    message : String;
    isRead  : Boolean default false;

}


// Operator	Meaning
// eq	Equal
// ne	Not equal
// gt	Greater than
// ge	Greater than or equal
// lt	Less than
// le	Less than or equal
// and	AND condition
// or	OR condition