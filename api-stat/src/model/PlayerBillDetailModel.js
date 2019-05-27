const Tables = require('../lib/Model').Tables
const BaseModel = require('./BaseModel')

class PlayerBillDetailModel extends BaseModel {
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

    /**
     * 根据时间范围获取流水
     * @param {*} inparam 
     */
    queryByTime(inparam) {
        return this.query({
            IndexName: 'UserNameIndex',
            KeyConditionExpression: 'userName=:userName and createdAt > :createdAt',
            ProjectionExpression: 'amount,balance,createdAt',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':createdAt': inparam.createdAt
            }
        })
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

module.exports = PlayerBillDetailModel
