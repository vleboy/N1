const config = require('config')
const BaseModel = require('./BaseModel')
const _ = require('lodash')

class PlayerBillDetailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.PlayerBillDetail,
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
    async queryByTime(inparam) {
        return await this.query({
            IndexName: 'UserNameIndex',
            KeyConditionExpression: 'userName=:userName and createdAt > :startTime',
            ProjectionExpression: 'amount,createdAt,balance',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':startTime': inparam.startTime,
            }
        })
    }

    /**
     * 玩家流水分页查询，递归循环查询结果
     */
    async forQueryRes(query, array = [], pageSize = 20) {
        return this.db$('query', query).then((result) => {
            // 合并上一次的查询结果
            console.log(result.LastEvaluatedKey)
            array = array.concat(result.Items)
            // 如果查询结果已经超过指定数量，则截取到指定数量返回
            if (array.length >= pageSize) {
                array = array.slice(0, pageSize)
                return [array, true]
            }
            // 没有查询到指定数量，且数据库还有剩余数据，则继续递归查询 
            else if (result.LastEvaluatedKey) {
                query.ExclusiveStartKey = result.LastEvaluatedKey
                return this.forQueryRes(query, array, pageSize)
            }
            // 没有查询到指定数量，且数据库没有剩余数据，则全部返回 
            else {
                return [array, false]
            }
        }).catch((error) => {
            console.error(error)
        })
    }
}

module.exports = PlayerBillDetailModel