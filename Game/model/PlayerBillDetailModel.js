const Tables = require('../lib/Dynamo').Tables
const BaseModel = require('./BaseModel')

module.exports = class PlayerBillDetailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.PlayerBillDetail,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //查询bk对应的数量
    async bkQuery(inparam) {
        const bkRet = await this.query({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey = :businessKey',
            ExpressionAttributeValues: {
                ':businessKey': inparam.bk
            }
        })
        if (bkRet && bkRet.Items.length) {
            return bkRet.Items.length
        } else {
            return -1
        }
    }
}
