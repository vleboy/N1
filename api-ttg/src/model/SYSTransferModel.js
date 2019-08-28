const BaseModel = require('./BaseModel')

class SYSTransferModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'SYSTransfer'
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
}

module.exports = SYSTransferModel


