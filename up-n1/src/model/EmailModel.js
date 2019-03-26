const BaseModel = require('./BaseModel')
const GlobalConfig = require("../util/config")
const _ = require('lodash')
class EmailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.HawkeyeGameEmail,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //主键查询
    async getEmail(emid) {
        let res = await this.getItem({
            Key: {
                "emid": emid
            }
        })
        return res.Item
    }
}

module.exports = EmailModel