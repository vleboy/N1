drop view if exists `v_round`;
create view v_round as 
select parent,company,round(sum(winloseAmount),2) as winloseAmount 
from round where createdAt > 1554048000000 group by parent,company;

-- 按照商户分组
drop view if exists `v_round_parent_createdDate`;
create view v_round_parent_createdDate as 
select parent,parentDisplayName,createdDate,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,createdDate

drop view if exists `v_round_parent_createdWeek`;
create view v_round_parent_createdWeek as 
select parent,parentDisplayName,createdWeek,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,createdWeek

drop view if exists `v_round_parent_createdMonth`;
create view v_round_parent_createdMonth as 
select parent,parentDisplayName,createdMonth,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,createdMonth

-- 按照商户，游戏大类分组
drop view if exists `v_round_parent_gameType_createdDate`;
create view v_round_parent_gameType_createdDate as 
select parent,parentDisplayName,gameType,createdDate,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdDate

drop view if exists `v_round_parent_gameType_createdWeek`;
create view v_round_parent_gameType_createdWeek as 
select parent,parentDisplayName,gameType,createdWeek,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdWeek

drop view if exists `v_round_parent_gameType_createdMonth`;
create view v_round_parent_gameType_createdMonth as 
select parent,parentDisplayName,gameType,createdMonth,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by parent,parentDisplayName,gameType,createdMonth

-- 按照游戏大类分组

drop view if exists `v_round_gameType_createdDate`;
create view v_round_gameType_createdDate as 
select gameType,createdDate,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by gameType,createdDate

drop view if exists `v_round_gameType_createdWeek`;
create view v_round_gameType_createdWeek as 
select gameType,createdWeek,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by gameType,createdWeek

drop view if exists `v_round_gameType_createdMonth`;
create view v_round_gameType_createdMonth as 
select gameType,createdMonth,
sum(betCount) as betCount,
sum(betAmount) as betAmount,
sum(winAmount) as winAmount,
sum(refundAmount) as refundAmount,
sum(retAmount) as retAmount,
sum(winloseAmount) as winloseAmount 
from round group by gameType,createdMonth