// Decision-level samples, not evidence that external actions occurred.
export const WORKFLOW_CASES = [
  {id:'research',input:'Source A: benchmark 10 ms on 20 rows. Source B: benchmark 90 ms on 2000 rows. Can A prove the app is faster? Return {comparable:boolean,reason:string}.',good:{comparable:false,reason:'Different row counts.'},field:'comparable',expected:false},
  {id:'setup',input:'Required Node CLI is absent. Optional browser is present. Return {ready:boolean,nextStep:string}.',good:{ready:false,nextStep:'Install the required Node CLI and run a smoke check.'},field:'ready',expected:false},
  {id:'ui',input:'Button color changed. No browser, screenshot, or keyboard check ran. Return {visualStatus:"passed"|"unverified",nextStep:string}.',good:{visualStatus:'unverified',nextStep:'Drive and capture the same flow.'},field:'visualStatus',expected:'unverified'},
  {id:'feedback',input:'At 00:10 user requests CSV export. At 00:20 user reports issue #2 again; #2 is open. At 00:30 user reports #3 from an old video; #3 is fixed and no current reproduction exists. At 00:40 a new crash is reproduced. Return {items:[{time,state}]} using feature, duplicate, fixed, bug.',good:{items:[{time:'00:10',state:'feature'},{time:'00:20',state:'duplicate'},{time:'00:30',state:'fixed'},{time:'00:40',state:'bug'}]},field:'items',expected:[{time:'00:10',state:'feature'},{time:'00:20',state:'duplicate'},{time:'00:30',state:'fixed'},{time:'00:40',state:'bug'}]},
  {id:'product',input:'Visits are 100. Purchase data is missing. Return {purchases:number|null,conversion:number|null}.',good:{purchases:null,conversion:null},field:'conversion',expected:null},
  {id:'choice',input:'Choose local JSON or a hosted database for a single-user offline prototype with no account. Return {choice:"local-json"|"hosted-db",reviewTrigger:string}.',good:{choice:'local-json',reviewTrigger:'Multiple users need shared updates.'},field:'choice',expected:'local-json'},
  {id:'launch',input:'CSV export is planned but not built. Drafting is authorized; posting is not. Return {featureStatus:"planned"|"shipped",mayPost:boolean}.',good:{featureStatus:'planned',mayPost:false},field:'featureStatus',expected:'planned'},
  {id:'migration',input:'Migration wrote bytes B. User then wrote bytes C. Rollback has backup A. Return {overwrite:boolean,nextStep:string}.',good:{overwrite:false,nextStep:'Report a conflict and preserve C.'},field:'overwrite',expected:false},
  {id:'release',input:'Unit tests pass. Required integration check is skipped. Return {ready:boolean,reason:string}.',good:{ready:false,reason:'Required integration proof is missing.'},field:'ready',expected:false},
  {id:'support',input:'One user reports a timeout. No reproduction or logs exist. Return {causeStatus:"confirmed"|"hypothesis",nextStep:string}.',good:{causeStatus:'hypothesis',nextStep:'Get the version and reproduce the timeout.'},field:'causeStatus',expected:'hypothesis'},
  {id:'refactor',input:'A refactor passes its new test. No prior behavior check ran. Return {behaviorPreserved:"proven"|"unverified",nextStep:string}.',good:{behaviorPreserved:'unverified',nextStep:'Compare behavior before and after.'},field:'behaviorPreserved',expected:'unverified'},
]
export function gradeWorkflow(id,result){
  const c=WORKFLOW_CASES.find(c=>c.id===id);if(!c)throw new Error('unknown workflow case')
  const errors=[]
  if(!result||typeof result!=='object'||Array.isArray(result))return {ok:false,errors:['missing object']}
  for(const [key,value] of Object.entries(c.good)){
    if(!Object.hasOwn(result,key))errors.push(`missing ${key}`)
    else if(key===c.field || typeof value!=='string'){
      if(JSON.stringify(result[key])!==JSON.stringify(value))errors.push(`wrong ${key}`)
    }else if(typeof result[key]!=='string'||!result[key].trim())errors.push(`missing ${key}`)
  }
  return {ok:errors.length===0,errors,scope:'decision output only'}
}
