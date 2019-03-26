const BaseModel = require('./BaseModel')
const GlobalConfig = require("../util/config")
const _ = require('lodash')
class ToolModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.DianaPlatformTool,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //查询道具
    async getToolByName(toolName) {
        let res = await this.query({
            KeyConditionExpression: 'toolName = :toolName',
            ExpressionAttributeValues: {
                ':toolName': toolName
            }
        })
        return res.Items[0]
    }

}


module.exports = ToolModel