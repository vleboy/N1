let athena = require("../lib/athena")
const Tables = require('../libs/Dynamo')
export class MerchantModel extends athena.BaseModel {
    constructor({ displayId, parent, rate, msn, userId } = {}) {
        super(Tables.ZeusPlatformUser);
        this.displayId = this.displayId;
        this.parent = parent;
        this.rate = rate;
        this.userId = userId;
        this.msn = msn;
    }
    findById(displayId) {
        if (!displayId) {
            return [null, null];
        }
        return this.get({
            displayId
        }, [], "merchantIdIndex");
    }
}