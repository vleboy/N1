const { Tables, Model } = require('../lib/Dynamo')
const BaseModel = require('./BaseModel')
module.exports = class ConfigModel extends BaseModel {
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
            ExpressionAttributeNames: {
                '#code': 'code'
            },
            ExpressionAttributeValues: {
                ':code': inparam.code
            }
        })
        return ret.Items[0]
    }
}


