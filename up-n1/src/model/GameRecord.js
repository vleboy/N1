const BaseModel = require('./BaseModel')
const config = require('config')
const _ = require('lodash')
class GameRecord extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.HeraGameRecord,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //主键查询战绩
    async queryRecord(userName, betId) {
        let res = await this.getItem({
            Key: {
                "userName": userName,
                "betId": betId
            }
        })
        return res.Item
    }
    //索引查询
    async queryParentIdRecord(inparam) {
        let query = {
            IndexName: 'parentIdCreatedAtIndex',
            KeyConditionExpression: 'parentId  = :parentId AND createdAt BETWEEN :createdAt0 AND :createdAt1',
            FilterExpression: "gameType = :gameType",
            ExpressionAttributeValues: {
                ':parentId': inparam.parentId,
                ':gameType': +inparam.gameType,
                ':createdAt0': inparam.createdAt[0],
                ':createdAt1': inparam.createdAt[1]
            }
        }
        let res = await this.query(query)
        return res.Items
    }

}


module.exports = GameRecord