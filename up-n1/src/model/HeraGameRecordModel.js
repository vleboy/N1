const _ = require('lodash')
const BaseModel = require('./BaseModel')
const config = require('config')
/**
 * 战绩表实体
 */
class HeraGameRecordModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.HeraGameRecord
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //查询神秘大奖
    async getMysteryList(inparam) {
        let query = {
            IndexName: 'winTypeIndex',
            KeyConditionExpression: 'winType = :winType AND betTime  BETWEEN :betTime0  AND :betTime1 ',
            ProjectionExpression: 'betId,betTime,gameId,gameType,parentId,userId,userName,#record',
            ExpressionAttributeNames: {
                '#record': 'record'
            },
            ExpressionAttributeValues: {
                ':winType': inparam.winType || 'SecretBonus',
                ':betTime0': inparam.betTime[0],
                ':betTime1': inparam.betTime[1]
            }
        }
        let resList = await this.bindFilterQuery(query, inparam.query)
        return resList.Items
    }
}

module.exports = HeraGameRecordModel