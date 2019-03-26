const BaseModel = require('./BaseModel')
const Tables = require('../libs/Dynamo')

class StatRoundModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.StatRound
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
}

module.exports = StatRoundModel


