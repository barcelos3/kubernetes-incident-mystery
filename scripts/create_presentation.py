from pathlib import Path
from PIL import Image, ImageOps
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ASSETS = DOCS / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
OUT = DOCS / "Kubernetes-Incident-Mystery-Apresentacao.pptx"

BG = "F7F8FA"
WHITE = "FFFFFF"
INK = "172033"
MUTED = "667085"
LIGHT = "E5E7EB"
SOFT = "EEF2F7"
BLUE = "2563EB"
CYAN = "0891B2"
ORANGE = "F97316"
GREEN = "059669"
RED = "DC2626"
VIOLET = "7C3AED"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)


def rgb(value):
    return RGBColor.from_string(value)


def set_bg(slide, color=BG):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = rgb(color)


def box(slide, x, y, w, h, fill=WHITE, line=LIGHT, radius=True):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
        Inches(x), Inches(y), Inches(w), Inches(h),
    )
    shape.fill.solid(); shape.fill.fore_color.rgb = rgb(fill)
    shape.line.color.rgb = rgb(line); shape.line.width = Pt(1)
    return shape


def text(slide, value, x, y, w, h, size=18, color=INK, bold=False,
         font="DejaVu Sans", align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = shape.text_frame
    frame.clear(); frame.word_wrap = True
    frame.margin_left = frame.margin_right = Inches(.02)
    frame.margin_top = frame.margin_bottom = Inches(.01)
    frame.vertical_anchor = valign
    paragraph = frame.paragraphs[0]
    paragraph.alignment = align
    run = paragraph.add_run(); run.text = value
    run.font.name = font; run.font.size = Pt(size); run.font.bold = bold; run.font.color.rgb = rgb(color)
    return shape


def line(slide, x, y, w, color=BLUE, height=0.04):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(height))
    shape.fill.solid(); shape.fill.fore_color.rgb = rgb(color); shape.line.fill.background()
    return shape


def header(slide, section, title, subtitle=None):
    text(slide, section.upper(), .72, .38, 5.5, .25, 9, BLUE, True, "DejaVu Sans Mono")
    text(slide, title, .72, .83, 11.9, .72, 28, INK, True)
    if subtitle:
        text(slide, subtitle, .74, 1.58, 11.2, .42, 12, MUTED)
    line(slide, .72, 2.05, .72, BLUE)


def footer(slide, number):
    line(slide, .72, 7.05, 11.9, LIGHT, .015)
    text(slide, "Kubernetes Incident Mystery", .72, 7.14, 4, .16, 7, MUTED, False, "DejaVu Sans Mono")
    text(slide, f"{number:02d}", 12.0, 7.11, .55, .2, 8, MUTED, True, "DejaVu Sans Mono", PP_ALIGN.RIGHT)


def bullets(slide, items, x, y, w, h, size=15, color=INK, accent=BLUE):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    frame = shape.text_frame; frame.clear(); frame.word_wrap = True
    frame.margin_left = frame.margin_right = Inches(.02)
    for idx, item in enumerate(items):
        p = frame.paragraphs[0] if idx == 0 else frame.add_paragraph()
        p.text = f"•  {item}"
        p.font.name = "DejaVu Sans"; p.font.size = Pt(size); p.font.color.rgb = rgb(color)
        p.space_after = Pt(12)
    return shape


def chip(slide, label, x, y, w, color=BLUE):
    shape = box(slide, x, y, w, .38, SOFT, SOFT)
    frame = shape.text_frame; frame.clear(); frame.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = frame.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = label; r.font.name = "DejaVu Sans Mono"; r.font.size = Pt(8); r.font.bold = True; r.font.color.rgb = rgb(color)


def crop_image(source, target, crop, size):
    image = Image.open(source).convert("RGB").crop(crop)
    ImageOps.fit(image, size, method=Image.Resampling.LANCZOS).save(target, quality=92)


def image(slide, path, x, y, w, h):
    box(slide, x-.03, y-.03, w+.06, h+.06, WHITE, LIGHT, False)
    slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))


preview = ROOT / "kubernetes-mystery-preview.png"
mobile = ROOT / "kubernetes-mystery-mobile.png"
crop_image(preview, ASSETS / "hero-clean.png", (0, 0, 1440, 900), (1600, 900))
crop_image(preview, ASSETS / "workspace-clean.png", (0, 850, 1440, 1900), (1600, 1000))
crop_image(mobile, ASSETS / "mobile-clean.png", (0, 0, 390, min(1850, Image.open(mobile).height)), (520, 1080))

# 1 — Capa
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide)
line(slide, .72, .68, .9, ORANGE, .08)
text(slide, "KUBERNETES INCIDENT MYSTERY", .72, 1.12, 7.3, 1.55, 37, INK, True)
text(slide, "Aprendizado prático de troubleshooting\npor meio de casos investigativos.", .76, 3.05, 5.6, 1.0, 18, MUTED)
chip(slide, "3 NÍVEIS", .76, 4.45, 1.35, BLUE)
chip(slide, "SIMULADOR SEGURO", 2.28, 4.45, 1.95, GREEN)
chip(slide, "DEPLOY PORTÁTIL", 4.4, 4.45, 1.85, ORANGE)
image(slide, ASSETS / "hero-clean.png", 7.25, .72, 5.3, 5.95)
text(slide, "APRESENTAÇÃO DO PROJETO", .76, 6.5, 3.8, .25, 8, MUTED, True, "DejaVu Sans Mono")
footer(slide, 1)

# 2 — Desafio
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "01 · Contexto", "Por que ensinar Kubernetes como investigação?")
text(slide, "O treinamento tradicional ensina comandos.\nIncidentes exigem raciocínio.", .78, 2.48, 5.7, 1.3, 25, INK, True)
bullets(slide, ["Laboratórios reais aumentam custo e risco", "Receitas prontas não treinam diagnóstico", "O aluno precisa relacionar sintomas, logs e dependências"], .8, 4.1, 5.5, 1.65, 14, MUTED)
box(slide, 7.05, 2.5, 5.1, 3.35, WHITE, LIGHT)
text(slide, "A proposta", 7.45, 2.85, 2.5, .35, 13, BLUE, True)
text(slide, "Praticar a tomada de decisão em um terminal seguro, com pistas progressivas e feedback imediato.", 7.45, 3.45, 4.25, 1.25, 21, INK, True)
text(slide, "Sem kubeconfig. Sem credenciais. Sem impacto em produção.", 7.45, 5.12, 4.25, .4, 11, GREEN, True, "DejaVu Sans Mono")
footer(slide, 2)

# 3 — Produto
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "02 · Produto", "Uma experiência Kubernetes jogável")
image(slide, ASSETS / "workspace-clean.png", .72, 2.35, 7.25, 4.25)
text(slide, "O jogador", 8.48, 2.48, 3.2, .4, 19, INK, True)
bullets(slide, ["seleciona um nível", "executa kubectl simulado", "coleta evidências", "corrige a causa raiz", "valida a recuperação", "recebe XP e progresso"], 8.48, 3.1, 3.8, 2.75, 15, MUTED)
footer(slide, 3)

# 4 — Jornada
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "03 · Experiência", "O ciclo de aprendizagem")
steps = [("01","Observar","Estado e impacto"),("02","Investigar","get · describe · logs"),("03","Relacionar","Pistas e dependências"),("04","Corrigir","Patch mínimo"),("05","Validar","Saúde e conectividade")]
for idx,(num,name,copy) in enumerate(steps):
    x=.72+idx*2.49
    text(slide,num,x,2.6,.6,.3,9,BLUE,True,"DejaVu Sans Mono")
    line(slide,x,3.0,1.8,[BLUE,CYAN,VIOLET,ORANGE,GREEN][idx],.05)
    text(slide,name,x,3.35,2.0,.4,17,INK,True)
    text(slide,copy,x,4.0,1.95,.8,12,MUTED)
    if idx<4: text(slide,"→",x+2.02,3.42,.3,.3,16,LIGHT,True)
box(slide,1.55,5.35,10.2,.8,WHITE,LIGHT)
text(slide,"O foco é reduzir o espaço de busca do incidente — não memorizar uma sequência fixa.",1.85,5.62,9.6,.32,16,INK,True,align=PP_ALIGN.CENTER)
footer(slide, 4)

# 5 — Casos
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "04 · Conteúdo", "Três níveis de complexidade")
cases=[("1","Iniciante","Namespace Fantasma","Services, selectors e endpoints","1000 XP",BLUE),("2","Intermediário","ConfigMap Envenenado","Configuração e rollout","1600 XP",ORANGE),("3","Avançado","Bloqueio da Meia-Noite","NetworkPolicy e egress","2500 XP",VIOLET)]
for idx,(num,level,name,topic,xp,color) in enumerate(cases):
    x=.72+idx*4.16
    box(slide,x,2.38,3.72,3.9,WHITE,LIGHT)
    text(slide,num,x+.26,2.68,.5,.55,26,color,True,"DejaVu Sans Mono")
    text(slide,level.upper(),x+.85,2.78,1.9,.25,9,color,True,"DejaVu Sans Mono")
    text(slide,xp,x+2.55,2.78,.75,.25,8,MUTED,True,"DejaVu Sans Mono",PP_ALIGN.RIGHT)
    text(slide,name,x+.26,3.55,3.0,.8,20,INK,True)
    text(slide,topic,x+.26,4.55,3.0,.5,12,MUTED)
    line(slide,x+.26,5.35,2.9,color,.035)
    text(slide,"Tutorial próprio · evidências · conclusão",x+.26,5.65,3.05,.3,9,MUTED,False,"DejaVu Sans Mono")
footer(slide, 5)

# 6 — Modos
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "05 · Usabilidade", "Livre para explorar. Guiado para aprender.")
box(slide,.72,2.35,5.85,3.75,WHITE,LIGHT)
chip(slide,"MODO INVESTIGAÇÃO",1.05,2.7,1.95,ORANGE)
text(slide,"Avaliação e prática",1.05,3.4,4.7,.45,21,INK,True)
bullets(slide,["Sem ordem obrigatória", "Hipóteses construídas pelo jogador", "Evidências aparecem conforme a investigação"],1.05,4.18,4.7,1.45,14,MUTED)
box(slide,6.75,2.35,5.85,3.75,WHITE,LIGHT)
chip(slide,"MODO TUTORIAL",7.08,2.7,1.65,BLUE)
text(slide,"Aprendizado assistido",7.08,3.4,4.7,.45,21,INK,True)
bullets(slide,["Etapas específicas para cada caso", "Comando sugerido e explicação", "Progressão automática após cada descoberta"],7.08,4.18,4.7,1.45,14,MUTED)
footer(slide, 6)

# 7 — Arquitetura
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "06 · Arquitetura", "Poucas peças, ampla portabilidade")
image(slide, DOCS / "architecture.png", .72, 2.32, 11.9, 4.45)
footer(slide, 7)

# 8 — Deploy
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "07 · Implantação", "O mesmo dist/ em diferentes infraestruturas")
options=[("Static hosting","Pages · Netlify · Vercel · SWA",BLUE),("Object storage + CDN","S3/CloudFront · GCS/CDN",CYAN),("Contêiner","Nginx não privilegiado · :8080",GREEN),("Kubernetes","Deployment · Service · Ingress",VIOLET)]
for idx,(name,copy,color) in enumerate(options):
    x=.72+(idx%2)*6.08;y=2.38+(idx//2)*1.95
    box(slide,x,y,5.75,1.5,WHITE,LIGHT)
    line(slide,x,y,.08,color,1.5)
    text(slide,name,x+.35,y+.28,4.7,.38,17,INK,True)
    text(slide,copy,x+.35,y+.86,4.8,.3,11,MUTED,False,"DejaVu Sans Mono")
text(slide,"Build command",.8,6.38,1.4,.22,8,MUTED,True,"DejaVu Sans Mono")
text(slide,"npm ci && npm run build",2.25,6.31,3.4,.32,12,BLUE,True,"DejaVu Sans Mono")
text(slide,"Output",7.25,6.38,.75,.22,8,MUTED,True,"DejaVu Sans Mono")
text(slide,"dist/",8.05,6.31,1.2,.32,12,ORANGE,True,"DejaVu Sans Mono")
footer(slide, 8)

# 9 — Container + K8s
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "08 · Operação", "Pronto para contêiner e Kubernetes")
text(slide,"CONTAINER",.8,2.5,2,.3,9,GREEN,True,"DejaVu Sans Mono")
text(slide,"Node 22",.8,3.05,2.4,.4,20,INK,True)
text(slide,"build",.8,3.55,2.4,.3,11,MUTED)
text(slide,"→",3.15,3.35,.4,.3,18,LIGHT,True)
text(slide,"dist/",3.7,3.05,2.2,.4,20,INK,True)
text(slide,"assets estáticos",3.7,3.55,2.4,.3,11,MUTED)
text(slide,"→",5.95,3.35,.4,.3,18,LIGHT,True)
text(slide,"Nginx",6.5,3.05,2.2,.4,20,INK,True)
text(slide,"non-root · /healthz",6.5,3.55,2.5,.3,11,MUTED)
line(slide,.8,4.35,8.15,GREEN,.04)
text(slide,"KUBERNETES",9.65,2.5,2,.3,9,VIOLET,True,"DejaVu Sans Mono")
bullets(slide,["2 réplicas", "RollingUpdate", "readiness + liveness", "PDB", "Ingress opcional"],9.65,3.05,2.5,2.25,13,MUTED)
box(slide,.8,5.15,8.15,.85,SOFT,SOFT)
text(slide,"docker build -t kubernetes-incident-mystery:1.0.0 .",1.08,5.43,7.6,.3,11,BLUE,True,"DejaVu Sans Mono")
footer(slide, 9)

# 10 — Qualidade
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "09 · Confiança", "Qualidade e segurança por desenho")
metrics=[("9","testes unitários",BLUE),("3","casos E2E",GREEN),("22","comandos validados",ORANGE),("0","erros de runtime",VIOLET)]
for idx,(value,label,color) in enumerate(metrics):
    x=.72+idx*3.06
    text(slide,value,x,2.55,1.35,.75,34,color,True,"DejaVu Sans Mono")
    text(slide,label,x,3.42,2.45,.3,10,MUTED,True,"DejaVu Sans Mono")
    line(slide,x,3.9,2.45,LIGHT,.02)
bullets(slide,["Nenhum shell, kubeconfig ou API real no Modelo 1", "Sem backend, banco de dados ou segredos", "Container não privilegiado", "Health checks, limites e rollback documentados"],.82,4.65,11.7,1.65,15,INK)
footer(slide, 10)

# 11 — Roadmap
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide); header(slide, "10 · Roadmap", "Evolução gradual, sem comprometer a segurança")
road=[("Curto prazo","Schema declarativo de casos\nMais cenários simulados",BLUE),("Médio prazo","Modelo 2 com Kind\nPontuação e trilhas",ORANGE),("Longo prazo","LMS e turmas\nSandboxes remotos",VIOLET)]
for idx,(phase,copy,color) in enumerate(road):
    x=.72+idx*4.16
    text(slide,f"0{idx+1}",x,2.55,.6,.4,16,color,True,"DejaVu Sans Mono")
    text(slide,phase,x,3.1,3.3,.4,18,INK,True)
    text(slide,copy,x,3.85,3.3,.95,14,MUTED)
    line(slide,x,5.2,3.35,color,.04)
text(slide,"Próxima entrega recomendada",.8,5.85,2.4,.25,8,MUTED,True,"DejaVu Sans Mono")
text(slide,"Modelo 2 com cluster Kind efêmero e tutorial completo",3.25,5.77,8.5,.35,15,INK,True)
footer(slide, 11)

# 12 — Encerramento
slide = prs.slides.add_slide(prs.slide_layouts[6]); set_bg(slide)
line(slide,.72,.75,.9,ORANGE,.08)
text(slide,"Aprender Kubernetes\nresolvendo incidentes.",.72,1.3,9.8,1.55,36,INK,True)
text(slide,"Modelo 1 pronto · três níveis · implantação portátil",.76,3.4,8.2,.45,17,MUTED)
box(slide,.76,4.48,11.8,1.1,WHITE,LIGHT)
text(slide,"PROJETO",1.08,4.73,1,.2,8,MUTED,True,"DejaVu Sans Mono")
text(slide,"~/kubernetes-incident-mystery",2.15,4.66,4.1,.32,13,BLUE,True,"DejaVu Sans Mono")
text(slide,"DEPLOY",7.2,4.73,.8,.2,8,MUTED,True,"DejaVu Sans Mono")
text(slide,"docs/03-DEPLOYMENT.md",8.0,4.66,3.6,.32,13,ORANGE,True,"DejaVu Sans Mono")
text(slide,"KUBERNETES INCIDENT MYSTERY",.76,6.55,4.2,.25,8,MUTED,True,"DejaVu Sans Mono")
footer(slide, 12)

prs.save(OUT)
print(OUT)
