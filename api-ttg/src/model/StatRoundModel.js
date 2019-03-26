const BaseModel = require('./BaseModel')

class StatRoundModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'StatRound'
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
}

module.exports = StatRoundModel


