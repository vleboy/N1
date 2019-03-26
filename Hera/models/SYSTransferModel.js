const BaseModel = require('./BaseModel')
const Tables = require('../libs/Dynamo')
class SYSTransferModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.SYSTransfer
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    async getBkSN(inparam) {
        const res = await this.getItem({
            ConsistentRead: true,
            ProjectionExpression: 'balance,#status,#type',
            Key: { 'businessKey': inparam.businessKey, 'sn': inparam.sn },
            ExpressionAttributeNames: {
                '#status': 'status',
                '#type': 'type'
            }
        })
        if (res && res.Item) {
            if (res.Item.type == 3 || res.Item.status == 'Y') {
                return res.Item
            } else {
                return {}
            }
        } else {
            return {}
        }
    }
}

module.exports = SYSTransferModel


