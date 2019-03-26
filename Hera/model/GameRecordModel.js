import { CODES, CHeraErr } from "../lib/Codes"
import { BaseModel } from "../lib/athena"
const Tables = require('../libs/Dynamo')

export class GameRecordModel extends BaseModel {
    constructor({ record, userId, userName, betTime, betId, gameId, parentId } = {}) {
        super(Tables.HeraGameRecord);
        this.userId = userId; //用户ID
        this.userName = userName; //用户名
        this.gameId = gameId;
        this.betId = betId;  //投注编号
        this.betTime = betTime;  //投注时间
        this.parentId = parentId; //上一级ID
        this.createdAt = Date.now();
        this.record = record; //记录，包含所有的详情
    }
    async page(pageSize, parentId, userName, gameId, startTime, endTime, lastTime, gameType) {
        //找到总数
        let opts = {
            IndexName: "parentIdIndex",
            ScanIndexForward: false,
            KeyConditionExpression: "betTime between :startTime and :endTime and parentId=:parentId",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":startTime": startTime,
                ":endTime": endTime,
                ":parentId": parentId,
                ":status": 3,
            }
        }
        opts.FilterExpression = "#status <> :status";
        // if(userName || gameId) {
        //     opts.FilterExpression = "";
        // }
        if (userName) {
            opts.FilterExpression += "userName=:userName ",
                opts.ExpressionAttributeValues[":userName"] = userName;
        }
        if (gameId) {
            if (userName) {
                opts.FilterExpression += "and gameId=:gameId";
            } else {
                opts.FilterExpression += "gameId=:gameId";
            }
            opts.ExpressionAttributeValues[":gameId"] = gameId + "";
        }
        if (gameType) {
            if (userName || gameId) {
                opts.FilterExpression += "and gameType=:gameType";
            } else {
                opts.FilterExpression += "gameType=:gameType";
            }
            opts.ExpressionAttributeValues[":gameType"] = +gameType;
        }
        let [countErr, count] = await this.count(opts);
        if (countErr) {
            return [countErr, null]
        }
        let page = {
            total: count,
            pageSize: pageSize,
            list: []
        }
        console.log("count:" + count);
        opts.Limit = 1000;
        delete opts.ExclusiveStartKey;
        if (lastTime) {
            // opts.ExpressionAttributeValues[":endTime"] = lastTime-1;
            opts.ExpressionAttributeValues[":endTime"] = lastTime;
        }
        let [pageErr] = await this.findRecords(opts, page);
        if (pageErr) {
            return [pageErr, page];
        }
        page.pageSize = page.list.length;
        page.lastTime = (page.list[page.pageSize - 1] || {}).betTime || 0;
        page.list.forEach((item, index) => {
            page.list[index] = page.list[index].record;
        })
        return [pageErr, page];
    }
    async findRecords(opts, page) {
        let [dbErr, result] = await this.db(opts);
        if (dbErr) {
            console.log(dbErr);
            return [dbErr, null];
        }
        let lastRecord = result.LastEvaluatedKey;
        // console.log("---------------");
        // console.log(lastRecord);
        // console.log(result.Items.length);
        page.list = page.list.concat(result.Items);
        if (page.list.length >= page.pageSize) {
            page.list = page.list.slice(0, page.pageSize)
            return [null, page]
        } else if (lastRecord) {
            // opts.ExpressionAttributeValues[":endTime"] = lastRecord.betTime-1;
            // opts.ExpressionAttributeValues[":endTime"] = lastRecord.betTime;
            opts.ExclusiveStartKey = lastRecord;
            return this.findRecords(opts, page);
        } else {
            return [null, page];
        }
    }
    async db(opts) {
        return new Promise((reslove, reject) => {
            this.db$("query", opts).then((result) => {
                reslove([null, result]);
            }).catch((err) => {
                console.log(err);
                reslove([new CHeraErr(CODES.SystemError, err.stack), null]);
            });
        })
    }
    async count(opts, count = 0) {
        opts.Select = "COUNT";
        return this.db$("query", opts).then((result) => {
            count += result.Count
            if (result.LastEvaluatedKey) {
                opts.ExclusiveStartKey = result.LastEvaluatedKey;

                return this.count(opts, count);
            } else {
                delete opts.Select
                return [null, count];
            }
        }).catch((error) => {
            console.log(error);
            let e = new AError(CODES.DB_ERROR);
            e.errMsg = error.message;
            return [e, []];
        })
    }

}
