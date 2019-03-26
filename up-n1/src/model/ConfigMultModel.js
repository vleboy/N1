
const Model = require('../lib/Model').Model
const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')
class ConfigMultModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.SYSConfigMult,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem,
            code: Model.StringValue,
            businessKey: Model.StringValue
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
     * 查询单个
     * @param {*} inparam
     */
    async getOne(inparam) {
        const ret = await this.query({
            KeyConditionExpression: '#code = :code AND #businessKey = :businessKey',
            ExpressionAttributeNames: {
                '#code': 'code',
                '#businessKey': 'businessKey'
            },
            ExpressionAttributeValues: {
                ':code': inparam.code,
                ':businessKey': inparam.businessKey
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items[0]
        } else {
            return 0
        }
    }

    /**
     * 查询列表
     * @param {*} inparam
     */
    async page(inparam) {
        let query = {
            KeyConditionExpression: '#code = :code',
            ExpressionAttributeNames: {
                '#code': 'code',
            },
            ExpressionAttributeValues: {
                ':code': inparam.code,
            }
        }
        const queryRet = await this.query(query)
        return queryRet.Items
    }
    /**
     * 删除单个
     */
    async delConfig(inparam) {
        const ret = await this.deleteItem({
            Key: {
                'code': inparam.code,
                'businessKey': inparam.businessKey
            }
        })
        return ret
    }
}

module.exports = ConfigMultModel
