
const Model = require('../lib/Model').Model
const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')
class ConfigModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.SYSConfig,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            code: Model.StringValue
        }
    }

    /**
     * 添加
     * @param {*} inparam
     */
    async add(inparam) {
        const dataItem = {
            ...this.item,
            ...inparam
        }
        // 保存
        const putRet = await this.putItem(dataItem)
        return dataItem
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


module.exports = ConfigModel