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
        let res= await this.getItem({
            Key: {
                "userName": userName,
                "betId": betId
            }
        })
        return res.Item
    }

}


module.exports = GameRecord