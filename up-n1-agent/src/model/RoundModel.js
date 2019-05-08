const BaseModel = require('./BaseModel')
const config = require('config')
const _ = require('lodash')
class RoundModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.StatRound,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
}


module.exports = RoundModel