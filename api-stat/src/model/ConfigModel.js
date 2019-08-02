const Tables = require('../lib/Model').Tables
const Model = require('../lib/Model').Model
const BaseModel = require('./BaseModel')

class ConfigModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.SYSConfig,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            code: Model.StringValue
        }
    }
    //查询最后写入的时间
    async queryLastTime(inparam) {
        const ret = await this.query({
            KeyConditionExpression: '#code = :code',
            ExpressionAttributeNames: { '#code': 'code' },
            ExpressionAttributeValues: { ':code': inparam.code }
        })
        return ret.Items[0]
    }
    // 更新VG最后同步ID
    updateLastVGId(inparam) {
        return this.updateItem({
            KeyConditionExpression: '#code = :code',
            UpdateExpression: 'SET lastVGId = :lastVGId',
            ExpressionAttributeNames: { '#code': 'code' },
            ExpressionAttributeValues: { ':code': inparam.code, ':lastVGId': inparam.lastVGId }
        })
    }
}

module.exports = ConfigModel
