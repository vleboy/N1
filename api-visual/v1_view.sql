drop view if exists `v_round`;
create view v_round as 
select parent,company,round(sum(winloseAmount),2) as winloseAmount 
from round where createdAt > 1554048000000 group by parent,company;

-- 按照商户，游戏大类分组
drop view if exists `v_round_parent_gameType_createddate`;
create view v_round_parent_gameType_createddate as 
select parent,parentDisplayName,gameType,createdDate,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdDate

drop view if exists `v_round_parent_gameType_createdweek`;
create view v_round_parent_gameType_createdweek as 
select parent,parentDisplayName,gameType,createdWeek,
ROUND(sum(betCount) as betCount,
ROUND(sum(betAmount) as betAmount,
ROUND(sum(winAmount) as winAmount,
ROUND(sum(refundAmount) as refundAmount,
ROUND(sum(retAmount) as retAmount,
ROUND(sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdWeek

drop view if exists `v_round_parent_gameType_createdmonth`;
create view v_round_parent_gameType_createdmonth as 
select parent,parentDisplayName,gameType,createdMonth,
ROUND(sum(betCount) as betCount,
ROUND(sum(betAmount) as betAmount,
ROUND(sum(winAmount) as winAmount,
ROUND(sum(refundAmount) as refundAmount,
ROUND(sum(retAmount) as retAmount,
ROUND(sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdMonth

-- 按照商户分组
drop view if exists `v_round_parent_createddate`;
create view v_round_parent_createddate as 
select parent,parentDisplayName,createdDate,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,createdDate
order by createdDate

drop view if exists `v_round_parent_createdweek`;
create view v_round_parent_createdweek as 
select parent,parentDisplayName,createdWeek,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,createdWeek
order by createdWeek

drop view if exists `v_round_parent_createdmonth`;
create view v_round_parent_createdmonth as 
select parent,parentDisplayName,createdMonth,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by parent,parentDisplayName,createdMonth
order by createdMonth

-- 按照游戏大类分组
drop view if exists `v_round_gameType_createddate`;
create view v_round_gameType_createddate as 
select gameType,createdDate,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by gameType,createdDate
order by createdDate

drop view if exists `v_round_gameType_createdweek`;
create view v_round_gameType_createdweek as 
select gameType,createdWeek,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by gameType,createdWeek
order by createdWeek

drop view if exists `v_round_gameType_createdmonth`;
create view v_round_gameType_createdmonth as 
select gameType,createdMonth,
ROUND(sum(betCount),2) as betCount,
ROUND(sum(betAmount),2) as betAmount,
ROUND(sum(winAmount),2) as winAmount,
ROUND(sum(refundAmount),2) as refundAmount,
ROUND(sum(retAmount),2) as retAmount,
ROUND(sum(winloseAmount),2) as winloseAmount 
from round group by gameType,createdMonth
order by createdMonth