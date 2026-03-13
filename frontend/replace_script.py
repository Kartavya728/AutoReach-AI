import re

path_route = r"d:\Projects\KAGGLE\CampaignX\WebInterface\app\api\campaigns\[id]\route.ts"
with open(path_route, "r") as f:
    route_content = f.read()

# Remove the update and opt suggestions block in route.ts
route_content = re.sub(
    r"\s*// Update cached metrics in Supabase.*?}\s*}",
    "\n      }",
    route_content,
    flags=re.DOTALL
)

with open(path_route, "w") as f:
    f.write(route_content)

path_analysis = r"d:\Projects\KAGGLE\CampaignX\WebInterface\src\lib\server\analysis.ts"
with open(path_analysis, "r", encoding="utf-8") as f:
    analysis_content = f.read()

# Replace the simulated engagement totals block
target_block_1 = r"const hash = stableHash\(campaignId\);.*?const clickRate = totalSent > 0 \? round\(\(totalClicked / totalSent\) \* 100\) : 0;"

replacement_1 = r"""const hash = stableHash(campaignId);
  const dbOpenRate = campaign?.open_rate || 0;
  const dbClickRate = campaign?.click_rate || 0;
  
  const totalOpenedVal = records.filter(r => r.EO === 'Y').length;
  const totalClickedVal = records.filter(r => r.EC === 'Y').length;
  
  const totalOpened = totalOpenedVal > 0 ? totalOpenedVal : Math.round(totalSent * (dbOpenRate/100));
  const totalClicked = totalClickedVal > 0 ? totalClickedVal : Math.round(totalSent * (dbClickRate/100));
  
  const openRate = totalOpenedVal > 0 ? round((totalOpened / totalSent) * 100) : dbOpenRate;
  const clickRate = totalClickedVal > 0 ? round((totalClicked / totalSent) * 100) : dbClickRate;"""

analysis_content = re.sub(target_block_1, replacement_1.replace('\\', '\\\\'), analysis_content, flags=re.DOTALL)

# Replace the simulated EO / EC assign block 
target_block_2 = r"const assignedRecords = records\.map\(\(r,\s*i\)\s*=>\s*\{.*?return\s*rec;\s*\}\);"

replacement_2 = r"""const assignedRecords = records.map((r, i) => {
    let hour = 10;
    try {
      const timePart = r.send_time || r.invokation_time || "";
      const match = timePart.match(/(\d{1,2}):/);
      if (match) {
        hour = parseInt(match[1], 10);
      }
    } catch {
      hour = 10;
    }
    return { ...r, _hour: hour };
  });"""

analysis_content = re.sub(target_block_2, replacement_2.replace('\\', '\\\\'), analysis_content, flags=re.DOTALL)

target_block_3 = r"function buildDeviceBreakdown\(hash:\s*number\)\s*\{.*?];\s*}"
replacement_3 = r"""function buildDeviceBreakdown() {
  return [
    { device: "Mobile", percentage: 55 },
    { device: "Desktop", percentage: 35 },
    { device: "Tablet", percentage: 10 },
  ];
}"""

analysis_content = re.sub(target_block_3, replacement_3.replace('\\', '\\\\'), analysis_content, flags=re.DOTALL)
analysis_content = analysis_content.replace("deviceBreakdown(hash)", "deviceBreakdown()")

with open(path_analysis, "w", encoding="utf-8") as f:
    f.write(analysis_content)

print("Replaced content successfully.")
