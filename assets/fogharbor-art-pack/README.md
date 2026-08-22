# 作品集美术素材整理

本素材包从当前 Unity 项目中筛选了更适合放入个人作品集的自制美术资产，并额外生成了预览板、序列帧动图和拆帧文件。第三方插件图、TextMesh Pro、Joystick Pack、DOTween 等资源没有纳入作品集素材。

## 文件结构

- `showcase/`：可直接放进作品集页面的展示图。
- `assets/characters/spritesheets/`：角色原始序列帧图。
- `assets/characters/frames/`：从序列帧图拆出的单帧 PNG。
- `assets/characters/animations/`：为作品集预览生成的角色 GIF。
- `assets/environments/layers/`：雾港场景远景、云、海、雾层等分层素材。
- `assets/environments/scene_parts/`：灯塔、房屋、码头、船、芦苇、灯具和船周水花序列。
- `assets/vfx/`：水纹、泡沫、雾、光束、记忆显现等效果素材。
- `assets/screenshots/`：Unity 内运行/编辑器截图。
- `asset_manifest.json`：素材来源与生成记录。

## 推荐展示顺序

1. `showcase/fogharbor_scene_reconstructed_4x.png`
   - 用作作品集首图或场景总览。
   - 展示能力点：480x270 像素画布、4x 整数放大、雾港氛围、远中近景分层、建筑/船/码头组合。

2. `showcase/characters_sprite_overview.png`
   - 展示完整角色组和 idle/walk 序列帧。
   - 展示能力点：低像素下的角色辨识度、姿态差异、人物和动物的动作节奏、NPC 性格轮廓。

3. `assets/characters/animations/*.gif`
   - 可插入作品集页面做动作预览。
   - 包含：主角、老人、孩子、猫、灵魂的待机或行走循环。

4. `showcase/environment_layers_showcase.png`
   - 展示场景从分层素材到完整构图的过程。
   - 展示能力点：2D 场景拆层、雾/云/海面调性统一、前景道具和建筑的像素材质表现。

5. `showcase/vfx_showcase.png`
   - 展示水面、雾、光束、记忆效果等功能型 VFX 素材。
   - 展示能力点：小尺寸像素 VFX 的可复用性、Unity 2D 场景中的水面动态支撑。

6. `showcase/in_engine_screenshots_board.png`
   - 展示最终 Unity 内效果。
   - 展示能力点：素材落地、灯塔倒影、水纹、雾层和场景排序的实际运行效果。

## 角色素材描述

### 主角 Keeper / Main Character

- 关键文件：`mc_idle.png`、`mc_walk.png`、`mc_idle.gif`、`mc_walk.gif`
- 规格：29x54 单帧，idle 4 帧，walk 4 帧。
- 描述建议：主角使用高挑剪影、深色斗篷和手提灯作为识别点，在小尺寸像素画中保持头身比例、服装层次和道具轮廓清晰。待机和行走帧重点体现身体重心变化、披风/灯笼的轻微摆动。

### 老人 NPC

- 关键文件：`oldman_idle.png`、`oldman_walk.png`、`oldman_idle.gif`、`oldman_walk.gif`
- 规格：idle 4 帧，walk 10 帧。
- 描述建议：老人通过弯腰姿态、拐杖和偏长四肢建立角色年龄感。10 帧行走循环让拐杖落点和身体前倾节奏更完整，适合展示动作设计能力。

### 孩子 NPC

- 关键文件：`kids_idle.png`、`kids_walk.png`、`kids_idle.gif`、`kids_walk.gif`
- 规格：约 34px 高，idle 4 帧，walk 4 帧。
- 描述建议：双人角色在很小像素尺寸下仍保持发型、服装颜色和站位关系可读，适合展示小体量 NPC 的形状归纳与色块控制。

### 猫 Companion

- 关键文件：`cat_idle.png`、`cat_walk.png`、`cat_idle.gif`、`cat_walk.gif`
- 规格：22x16 单帧，idle 8 帧，walk 6 帧。
- 描述建议：猫的体量极小，动作主要依赖尾巴、头部和身体伸缩来传达生命感。可作为作品集中的“微型角色动画”案例。

### Lost Soul

- 关键文件：`soul.png`、`soul_idle.gif`
- 规格：23x58 单帧，idle 4 帧。
- 描述建议：灵魂角色使用半透明浅色轮廓、发光头部和破碎披挂形状，和其他人类 NPC 形成材质与气质对比，适合放在角色组最后作为特殊状态/记忆主题角色。

## 场景与 VFX 描述

### Fogharbor 场景

- 关键文件：`BG_Sky_DayFog.png`、`BG_FarMountain_DayFog.png`、`BG_SeaBase_DayFog.png`、`BG_CloudBase_DayFog.png`、`Scene_Lighthouse_Body.png`、`Scene_House_Front.png`、`Scene_Dock_Back.png`、`Scene_Dock_Front.png`、`boat_front.png`
- 描述建议：雾港场景采用低饱和蓝灰色调，使用天空、远山、海面、云雾、建筑、码头和船体多层组织深度。场景重点是安静、潮湿、带回忆感的海边氛围。

### 水面和船周效果

- 关键文件：`Ripple_Line_00.png` 到 `Ripple_Line_05.png`、`Foam_Streak_01.png`、`water_start.gif`、`water_walking.gif`、`water_stop.gif`
- 描述建议：水面 VFX 以短横线、泡沫和透明雾层构成，配合 Unity 中的水纹脚本和排序层实现动态海面。船周水花分为启动、航行、停止三个状态，可展示功能型动画资源设计。

### 灯塔/记忆光效

- 关键文件：`PH_LightBeam.png`、`PH_MemoryReveal.png`、`FX_Lighthouse_Glow.png`、`Scene_Lighthouse_Bulb.png`
- 描述建议：光效素材以低透明度的大色块和小尺寸发光点为主，服务于灯塔、记忆显现和场景引导。适合搭配运行截图展示从单张 VFX 到场景氛围的落地效果。

## 技术规格可写入作品集

- 引擎：Unity 2D / URP 2D Renderer。
- 原生像素画布：480x270。
- 最终截图输出：1920x1080，4x 整数缩放。
- PPU：16。
- 导入规则：Point Filter、Mip Maps Off、Compression None。
- 场景组织：完整 Sprite 分层，不使用 Tilemap。
- Pivot：角色/建筑 Bottom Center，远景/UI Center。

## 备注

当前素材包只新增 `PortfolioArtPack/`，没有修改 Unity 源素材或场景。项目里原本存在未提交的 `GameMain/Assets/Scenes/Scene_Fogharbor_Base.unity` 修改，本次整理没有改动该文件。
