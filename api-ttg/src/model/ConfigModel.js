
const BaseModel = require('./BaseModel')
class ConfigModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: 'SYSConfig',
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            code: 'NULL!'
        }
    }

    /**
     * 查询单条
     * @param {*} inparam
     */
    async getOne(inparam) {
        const ret = await this.query({
            KeyConditionExpression: '#code = :code',
            ExpressionAttributeNames: {
                '#code': 'code',
            },
            ExpressionAttributeValues: {
                ':code': inparam.code,
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

}


module.exports = ConfigModel