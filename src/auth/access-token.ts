let token:string|null=null;
export const accessTokenStore={get:()=>token,set:(value:string|null)=>{token=value;}};
