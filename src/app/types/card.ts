// 共享类型：角色卡规范与校验结果

export interface CardSpecV2 {
  name?: string;
  description?: string;
  first_mes?: string;
  creator?: string;
  character_version?: string;
}

export interface CardData {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: CardSpecV2;
}

// 服务端批量校验返回项
export interface ServerValidation {
  originalName: string;
  status: 'valid' | 'invalid';
  errors: string[];
  warnings: string[];
  parsedData?: CardSpecV2;
}

// 前端用到的批量校验响应
export interface ValidateResponse {
  results: ServerValidation[];
}
