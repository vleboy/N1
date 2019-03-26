const Model = require('../lib/UserConsts').Model
const Util = require("../lib/athena").Util
const RegEnum = require("../lib/athena").RegEnum
class BillCheck {
    /**
     * 检查转账数据
     */
    checkBill(inparam) {
        let [checkAttError, errorParams] = Util.checkProperties([
            { name: "fromUserId", type: "NS", min: 36, max: 36 },
            { name: "toRole", type: "NN", min: 1, max: 1000 },
            { name: "toUser", type: "S", min: 5, max: 30 },
            { name: "amount", type: "REG", min: null, max: null, equal: RegEnum.PRICE },
            { name: "remark", type: "NS", min: 1, max: 200 }
        ], inparam)

        if (checkAttError) {
            Object.assign(checkAttError, { params: errorParams })
            throw checkAttError
        }
        // 数据类型处理
        inparam.amount = parseFloat(inparam.amount)
        inparam.toRole = inparam.toRole.toString()
        inparam.remark = inparam.remark || Model.StringValue
    }
}

module.exports = BillCheck