-- Objetivos dinâmicos (nome + meta editáveis, adicionar/remover)
ALTER TABLE invest_metas
ADD COLUMN IF NOT EXISTS objetivos_custom jsonb NOT NULL DEFAULT '[
  {"id":"leilao",    "emoji":"🏠","nome":"Fundo leilão",       "meta":100000},
  {"id":"reserva",   "emoji":"🛡️","nome":"Reserva emergência", "meta":30000},
  {"id":"aluguel27", "emoji":"🏢","nome":"Aluguel 2027",        "meta":37200},
  {"id":"pgbl",      "emoji":"📊","nome":"PGBL",                "meta":13000},
  {"id":"consorcio", "emoji":"🏡","nome":"Consórcio",           "meta":200000}
]'::jsonb;
