const BaseModel = require('./BaseModel')
const GlobalConfig = require("../util/config")
const _ = require('lodash')
class PackageModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.TOOL_PACKAGE,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //主键查询
    async getPackageByName(packageName) {
        let res = await this.getItem({
            KeyConditionExpression: 'packageName = :packageName',
            ExpressionAttributeValues: {
                ':packageName': packageName
            }
        })
        return res.Items[0]
    }

}


module.exports = PackageModel