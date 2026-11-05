"""Concise execution prompts for the approved military image job definitions."""
from pathlib import Path
import re


ATTACKS={
 'hero:kkomaMudang':'a single diagonal TACTICAL SABER CUT with torso and shoulder rotation',
 'ally:clubGoblin':'a single short ELECTRIC BATON STRIKE',
 'ally:oneLegGoblin':'a short forward TACTICAL DAGGER THRUST, mechanical legs planted',
 'ally:sumoGoblin':'a straight HYDRAULIC GAUNTLET PUNCH, balanced boxing footwork',
 'ally:foxfireArcher':'SNIPER RIFLE firing, buttstock braced on shoulder',
 'ally:gumiho':'GRENADE LAUNCHER firing with restrained shoulder recoil',
 'ally:bulgasari':'a heavy HYDRAULIC SLEDGEHAMMER STRIKE, both hands keep gripping the same shaft',
 'ally:haetae':'a short RIOT SHIELD BASH while feet support her armor weight',
 'ally:samjokgo':'a command-tablet gesture and fire from one of her EXACTLY THREE DRONES',
 'ally:magpieFlock':'a shot from her SHOULDER-MOUNTED MULTITUBE ANTI-AIR MISSILE LAUNCHER, feet planted',
 'ally:yeongdeungWind':'a pulse emitted by her HANDHELD ELECTRONIC JAMMING DEVICE, other hand keeps tablet',
 'enemy:waterGhostThrower':'SPIT-RELEASE BODY MOTION: enlarged throat compresses, jaw opens, neck and torso thrust forward; no expelled liquid is drawn',
 'enemy:sonGakshi':'infection-release BODY MOTION from back-sac mutant, back sac compressing slightly; no expelled liquid is drawn',
 'enemy:eodduksini':'a shot from the drone cannon, rigid fuselage slightly recoiling',
 'enemy:maidenGhost':'a single LONG-ARM CLAW SWIPE from low crouch',
 'enemy:dueoksini':'a heavy frontal ARM AND SHOULDER BATTERING STRIKE at base height',
 'boss:eodduksiniKing':'a shot from the airborne boss CANNON while fuselage stays balanced',
 'boss:imugiGangcheol':'a heavy ARMORED ARM STRIKE, orange core stays the same size',
}


EXTRAS={
 'skill_fan':['ready the saber','forward pressure-wave release slash','absorb torso and arm recoil','recover saber to low guard'],
 'skill_blessing':['check left command gauntlet','activate support pulse, left forearm raised','lower left arm with cloth follow-through','return to guard'],
 'skill_blade':['raise saber to open capacitor output','downward saber release strike','absorb downward strike weight through knees and hips','recover saber and settle'],
 'grab':['prepare restraint wire device behind shield','hold shield and forearm toward captured target, target is not drawn','recover restraint device and shield stance'],
 'grow':['torso briefly tenses','growth event reaction WITHOUT scaling up the body in the drawing','settle into original support stance'],
 'armor':['shoulder armor locking preparation','armor stack activation with EXACTLY the same armor plates','settle into original armored guard'],
 'summon':['infection sacs tense','upper body prepares brood release','summoning event posture WITHOUT drawing any summoned zombie','sacs and arms settle'],
 'tail':['draw armored arm back','wide armored-arm striking posture','core-output follow-through, no wave drawn','return armored arm to guard'],
 'descend':['unfold landing legs in air','descending posture, keep image root fixed','landing legs absorb impact, contact aligns to center pivot'],
 'ground_idle':['grounded support legs hold fuselage at center-pivot contact','same grounded position with tiny cable and joint settling'],
 'ascend':['release ground support and start folding legs, root fixed','legs folded in normal airborne posture, root fixed'],
}


EFFECT_DESIGNS={
 'fx_fan':'A short WHITE/PALE-CYAN forward half-circle pressure arc sweeping RIGHT. Transparent interior; no ground crater, fire or weapon.',
 'fx_blessing':'A MINT/TEAL support pulse, soft clean elliptical rim and small upward support chevrons. Preserve visibility through its transparent center.',
 'fx_saber_edge':'One SHORT WHITE/PALE-CYAN diagonal saber afterimage arc. No physical sword, no extra impact or ground ring.',
 'fx_hammer_hit':'One compact GOLD/WHITE crushing contact burst with a few tiny metal fragments. A single-target hammer impact, no sustained fire, fireball or large area field.',
 'fx_defense_break':'One small AMBER cracked armor-plate/shield status mark with separated crack segments. No ground ring, explosion or character.',
 'fx_exosuit_repair':'One compact MINT/GOLD mechanical recovery pulse with two upward output chevrons. No armor suit, character, fire or damaging explosion.',
 'fx_baton_hit':'A tiny WHITE/CYAN electric contact spark only. Short angular spark branches, not lightning crossing the screen; no stun icon or ground field.',
 'projectile_incendiary':'One small COPPER-JACKETED POINTED BULLET ONLY, the projectile after leaving the rifle barrel, pointing RIGHT with a short orange tracer tail. No brass cartridge case, casing cylinder, rim, primer, missile or grenade. The bullet is a single slim tapered copper ogive with a flat rear base.',
 'fx_incendiary_hit':'One small ORANGE incendiary impact flare with a few embers. No character or persistent burning-body silhouette.',
 'projectile_incendiary_grenade':'One STUBBY 40mm GRENADE-LAUNCHER PROJECTILE pointing RIGHT, domed rounded nose, short dark-gray cylindrical shell, orange identification band and a flat rear base. This is the launched grenade body ONLY, NO cartridge case. NOT a hand grenade: absolutely NO safety pin, pull ring, carrying ring, spoon, lever, handle, hooks or fins. No launcher.',
 'fx_grenade_burst':'One ORANGE incendiary grenade blast with a short expanding fire rim, detached from any projectile or launcher.',
 'fx_disorientation':'One small AMBER broken circular disorientation mark with a few offset arc segments, no head or text.',
 'fx_restraint_wire':'One taut curved METALLIC restraint wire with CYAN edge light, two small connection tips, no target or shield drawn.',
 'fx_guard_field':'One restrained PALE-CYAN translucent protective shield outline with an empty center, no physical shield prop or explosion.',
 'projectile_aa_missile':'One small modern ANTI-AIR MISSILE pointing RIGHT with FOUR small tail fins and a SHORT orange exhaust flame, no launcher.',
 'fx_target_lock':'One crisp CYAN target-lock reticle, four corner brackets and tiny central tick, no letters or numbers; no ground ring.',
 'fx_aa_stagger':'One small WHITE/CYAN aerial contact flash with two short stagger ticks, no aircraft, missile or victim.',
 'fx_boost_trail':'One SHORT PALE-CYAN booster exhaust streak trailing LEFT, tapered and detached from mechanical legs; no large ground aura.',
 'fx_dagger_cut':'One SHORT WHITE/SILVER dagger slash arc sweeping RIGHT, no physical knife, character or additional damage field.',
 'projectile_drone_incendiary':'One compact ORANGE incendiary tracer round pointing RIGHT with a short tail, no drone, missile or extra rounds.',
 'fx_command_aura':'One restrained GOLD/CYAN command aura with a hollow ground ellipse rim and sparse upward chevrons, no drone or commander.',
 'fx_incendiary_support':'One ORANGE incendiary support impact bloom with short embers, no aircraft, drone, projectile or character.',
 'fx_gauntlet_impact':'One compact WHITE/GOLD hydraulic punch impact burst, a few short angular impact rays, no fire or large ground field.',
 'fx_collision':'One compact WHITE/AMBER collision-contact spark with two opposed pressure arcs, no bodies, continuous beam or ground aura.',
 'projectile_emp':'One small MINT/CYAN electronic pulse projectile pointing RIGHT, compact wave lobes around a bright center, no physical missile.',
 'fx_jamming_aura':'One hollow MINT ground ellipse with a few restrained radio-wave arcs, transparent interior; no antenna device or character.',
 'fx_emp_burst':'One MINT/CYAN expanding electronic pulse ring with short angular digital-wave ticks, no flames or debris.',
 'fx_reflect':'One short WHITE/MINT angled deflection arc and a compact contact glint, no extra projectile or shield prop.',
 'fx_base_breach':'One compact GRAY/AMBER heavy structure impact with a few chipped masonry fragments, no actual base building or fire.',
 'fx_walker_hit':'One small GRAY/WHITE melee contact puff with a few short dust streaks, no gore, body or ground field.',
 'projectile_hover_round':'One compact RED/ORANGE machine-cannon tracer round pointing RIGHT, no drone or missile.',
 'fx_machine_spark':'One tiny YELLOW/WHITE machine failure spark with several short angular branches, no machine body or explosion.',
 'fx_fire_immunity':'One small GRAY/SILVER protective shield outline with an ORANGE flame glint deflected at its edge, no words or large burning effect.',
 'fx_growth_pulse':'One compact MUTED-RED biological growth pulse with short outward muscle-energy arcs, no body parts or enlarged zombie.',
 'fx_disruption_pulse':'One restrained PURPLE electronic suppression pulse, hollow elliptical ring and broken radio-wave arcs, no device or character.',
 'fx_armor_resist':'One small GRAY/BLUE armor-plate resistance glint, clean shield silhouette and two short reflected streaks, no body or large field.',
 'fx_mutation_veil':'One restrained translucent PURPLE mutant-veil shimmer, wispy thin arcs with a transparent center, no person or ghost face.',
 'fx_stalker_slash':'One SHORT PALE-GRAY claw swipe composed of three narrow parallel arcs, no hand, body or broad ground field.',
 'projectile_blight':'One compact PURPLE corrosive infection droplet pointing RIGHT with a short fluid tail, no back sac or zombie.',
 'fx_heal_block':'One small PURPLE medical-cross-shaped status mark interrupted by a clear diagonal blocking slash, no text, character or ground circle.',
 'projectile_slow_spit':'One compact GREEN infection-fluid glob pointing RIGHT with a short droplet tail, no mouth or zombie.',
 'fx_slow_splash':'One small GREEN infection-fluid contact splash, several short droplets around the contact center, no body or broad field.',
 'fx_tyrant_pulse':'One restrained DARK-PURPLE suppression pulse with a hollow expanding ellipse and short black/purple broken arcs, no boss body.',
 'projectile_overlord':'One compact RED/WHITE heavy aerial cannon projectile pointing RIGHT with a SHORT warm tracer, no airborne machine.',
 'fx_landing':'One GRAY/RED landing shockwave, hollow low ground ellipse and short dust streaks, no landing legs, machine or crater platform.',
 'fx_hive_spawn':'One small PURPLE/AMBER infection emergence reaction at a single spawn point, short organic wisps only, NO summoned zombie, larva or body.',
 'fx_core_shockwave':'One ORANGE/WHITE industrial-core shockwave with a low hollow ground ellipse and short heat distortion, no core prop or boss.',
 'fx_heat_absorb':'One compact ORANGE/GOLD inward heat-absorption swirl with small MINT recovery glints, no damaging explosion or physical core.',
 'fx_supply_disruption':'One small PURPLE electronic supply-disruption mark, interrupted battery/charge outline and broken descending ticks, no letters, digits or HUD panel.',
 'fx_armor_stack':'One small GRAY/BLUE layered armor status glint, three simple overlapping plate outlines with a short locking flash, no boss or large field.',
}


def execution_prompt(job, facts, units):
    key=job['subject_key']
    filename=Path(job['output']).stem
    width,height=job['target_size']
    style='Clean 2D ANIME GAME ART, consistent crisp linework and 2-3-tone cel shading, no SD/chibi, no 3D render, no text or watermark.'
    if job['kind']=='body':
        unit=units[key]
        prefix,number=filename.rsplit('_',1)
        n=int(number)
        refs=job['references']
        motion='neutral idle reference pose' if not refs else 'a single animation pose, preserving the exact referenced character'
        if prefix=='idle' and n:
            motion='small breathing/weight-shift idle pose, shoulders slightly settling; hair ends and loose fabric lag behind the torso'
        elif prefix=='walk':
            if 'AIRBORNE' in facts[key] or key in ('ally:samjokgo','enemy:eodduksini','boss:eodduksiniKing'):
                motion='flight movement loop, slight forward fuselage/formation tilt and stabilizing propulsion; no walking feet added'
            else:
                phases=['near leg contacts in front, far leg trails','weight passes over planted near leg while far leg swings','far leg contacts in front, near leg trails','weight passes over planted far leg while near leg swings']
                motion='in-place WALK CYCLE: '+phases[n%4]+'. Clearly different leg pose from neutral standing; planted foot does not slide'
                if n>=4:
                    motion='intermediate WALK pose between the attached neighboring reference poses; support foot stays planted, swing leg advances, pelvis and opposite shoulder balance. Not an identical copy of idle'
        elif prefix=='attack':
            attack=ATTACKS.get(key,'one forward MELEE ARM STRIKE with body weight support')
            phase=['short preparation','ACTUAL STRIKE OR FIRING MOMENT','immediate recoil/follow-through','recover toward guard','intermediate between recoil and recovery','finish settling into neutral guard'][n]
            motion=attack+'; current phase: '+phase
        elif prefix=='hit':
            motion=['short initial reaction to a hit','recover original balance','intermediate recoil-to-recovery reaction','settle back to neutral guard'][n]
        elif prefix=='spawn':
            motion=['preparation to enter idle stance','legs or fuselage settle into stable support','nearly neutral stance with slight hair/fabric/cable follow-through'][n]
        elif prefix=='death':
            if key in ('enemy:eodduksini','boss:eodduksiniKing'):
                motion=['initial machine power-loss reaction, propulsion and sensor brightness diminish','fuselage tilts nose-down into low disabled posture, propulsion nearly off','same disabled fuselage settles further NOSE DOWN, cables droop, sensors and propulsion OFF','FINAL DISABLED WRECK: preserve the preceding nose-down collapsed angle and low position; ALL red sensors, navigation lights, cyan lift rings and propulsion are DARK AND OFF; no glow anywhere, no powered hover, do not return to level idle posture; intact recognizable hull stays visibly drawn; game handles final opacity fade'][n]
            elif key=='ally:samjokgo':
                motion=['commander loses strength, drones tilt','body and formation lower into defeated posture','same defeated airborne formation sags, keep exactly three drones','stable defeated commander and three-drone formation; game handles fade'][n]
            else:
                motion=['initial loss of strength, knees begin bending','DOWN ON ONE KNEE, torso low, free hand supports body near ground','DOWN ON BOTH KNEES, torso and head LOWER than previous kneeling frame, weapon lowered, DO NOT stand up','remain COLLAPSED ON BOTH KNEES, head bowed and torso low, same support as previous frame, still visibly drawn; DO NOT stand up; game handles final opacity fade'][n]
        elif prefix in ('start','stop','turn'):
            motion={'start':['lean into first step or propulsion','accelerate hips/fuselage while hair/fabric/cables lag','connect into first movement-loop contact'],
                    'stop':['begin deceleration from movement','torso stops while loose parts continue briefly','settle into neutral guard'],
                    'turn':['decelerate to prepare direction change','counter-rotate torso slightly while keeping source facing right','settle into right-facing compensation guard; actual flip is handled by game']}[prefix][n]
        elif prefix=='suppress':
            motion=['prepare electronic or chest suppression output','open suppression output posture','pulse-release follow-through','return to guard'][min(n,3)]
        elif prefix in EXTRAS:
            motion=EXTRAS[prefix][n]
        morph=('AA flat adult chest: NO independent breast deformation or bounce. Hair and clothing still have natural follow-through.' if unit['morph']=='excluded' else
               'Clothed adult soft-tissue follow-through follows torso motion with restrained delayed settling; preserve body volume and garment support, never clip through clothing/armor.' if unit['morph']=='enabled' else
               'No allied breast-morph rule. Only material-appropriate tissue, fabric or cable follow-through; metal parts remain rigid.')
        locked='Use the first attached image as the approved character identity. Additional images are pose anchors only. Keep face, age, hairstyle, uniform, anatomy, equipment count and attachment points EXACTLY the same. Change ONLY the requested animation pose.' if refs else 'Create one new approved neutral character reference from the exact design below.'
        return (f'{style}\n\n{locked}\n\nEXACT DESIGN: {facts[key]}\n\n'
                f'POSE FOR THIS SINGLE FRAME: {motion}. File {filename}.png.\n\n'
                f'Whole body facing RIGHT in side view/slight 3/4 side view. Fixed camera, scale and root; target canvas {width}x{height}; normalized root {unit["origin"]}. Keep all limbs, hair, feet, cape and weapon/machine inside frame. No auto zoom or recentering. '
                f'{morph} Hair roots and rigid armor stay attached; hair tips, neckties, coat/skirt ends and cables lag naturally and damp. '
                'Actual transparent alpha background. ONE pose only. Keep the complete silhouette and weapon tips inside the canvas with clear transparent padding; never crop hair or a barrel. '
                'Muzzle flashes, emitted smoke, ejected casings, bullets, missiles and ALL expelled infection fluid/spit/droplets are separate VFX assets: do NOT draw them in this body frame, even at the firing moment. Keep the mouth area completely clear outside the jaw. '
                'No scenery, ground shadow, separate projectile, large attack trail, aura, victim, extra person or sprite sheet. No hit-reaction flash, halo, white disc, cloud, backdrop patch, head glow or impact mark around the body; only the isolated character silhouette is drawn. '
                +('Keep exactly one woman plus exactly THREE DRONES in the same airborne formation.' if key=='ally:samjokgo' else 'Do not add a companion drone or any other character.'))
    if key and job['kind']=='portrait':
        close=filename=='icon'
        return (f'{style}\n\nUse attached approved reference, preserve exact face/hair/body/uniform/equipment. {facts[key]}\n\n'
                +('ONE HEAD-AND-SHOULDERS PORTRAIT ONLY, with the face large and readable. Frame from top of head to upper chest. The input is a full-body reference but the OUTPUT MUST BE A CLOSE-UP. Omit lower torso, skirt, legs, drones and equipment outside this crop. NO full-body figure, no inset portrait, no circular badge, no collage, no second copy of the subject. Crop the camera, do not change body proportions.' if close else 'ONE full-body representative pose, whole head-to-feet/machine silhouette and weapon visible, fit by empty padding without squashing proportions.')
                +f' Target {width}x{height}. Actual transparent alpha. No scenery, frame, text, numbers, UI, extra person, or redesign.')
    if key and job['kind'] in ('projectile','effect'):
        slug=re.sub(r'_\d+$','',filename)
        title=slug.removeprefix('projectile_').removeprefix('fx_').replace('_',' ')
        phase=int(filename.rsplit('_',1)[1])
        projectile=job['kind']=='projectile'
        geometry=('One compact projectile pointing RIGHT with origin fixed at canvas center. Only internal flame/light phase changes, no translation across canvas.' if projectile else
                  'One isolated impact, status mark or ground-plane pulse appropriate to this effect. Ground circles project as flat ellipses. Keep origin fixed and visible margins.')
        colors='Use clean warm orange for incendiary/heat, cyan-white for saber/pressure, mint for support/EMP, green for slow spit and purple for blight/suppression.'
        if slug in ('fx_fan','fx_blade','fx_saber_edge'):
            colors='This is SHION pressure/saber energy: WHITE AND PALE CYAN ONLY, no flame, no fireball, no missile.'
        if slug in EFFECT_DESIGNS:
            geometry=EFFECT_DESIGNS[slug]+' Keep the origin fixed at canvas center and ample transparent padding on all sides.'
            colors='Use ONLY the specific palette stated in the design above.'
        if projectile:
            geometry+=' Depict the projectile IN FLIGHT after leaving its weapon: no cartridge casing, primer rim, hand-grenade pin, pull ring or safety lever.'
        if slug=='fx_blade':
            title='GROUND-PLANE RADIAL PRESSURE RING'
            phase_description=[
                'INITIAL COMPACT phase: one small clean ellipse rim, outer diameter 40 percent of canvas width',
                'EXPANDING BRIGHT phase: two thin ellipse rims, outer diameter 60 percent of canvas width',
                'EXPANDED DECAY phase: two thinning ellipse rims, outer diameter 70 percent of canvas width',
                'FINAL FADING phase: sparse broken segments of a thin ellipse rim, outer diameter 70 percent of canvas width',
            ][min(phase,3)]
            geometry=('Draw ONLY A THIN HOLLOW ELLIPTICAL OUTLINE, like a clean anime shockwave ring lying flat on the ground. '
                      'Its center is at EXACT canvas center (50 percent, 50 percent); ellipse height is one third of its width. '
                      +phase_description+'. '
                      'EVERY PIXEL INSIDE the ellipse must be completely transparent alpha zero, including the center. '
                      'Keep at least 15 percent fully transparent padding on LEFT AND RIGHT sides. '
                      'Only narrow white/cyan rim lines; NO fog, mist, cloud, smoke, filled disk, large glow, dust, vertical spike, sword, pillar or explosion. '
                      'This is a simple hollow horizontal ring, not an environmental scene. Keep the ellipse center fixed.')
        return (f'{style}\n\nCreate ONLY a standalone 2D game VFX frame of {title.upper()}, phase {phase}. '
                f'{geometry} {colors} Target {width}x{height}, actual transparent alpha. '
                'The EMPTY BACKGROUND must be alpha zero. Never paint white paper, a checkerboard transparency grid, a noise texture or any full-canvas haze. '
                'Use attached first-effect reference if provided, preserving effect structure, palette and center. '
                'NO character, face, hand, weapon, building, scenery, UI text, watermark or sprite sheet. The visual does not add extra targets or damage.\n\n'
                'Detailed approved effect specification:\n'+job['prompt'])
    return ('Create exactly the game support art specified below. '+style+' '
            'Match the attached references for identity or visual style if any. Output ONE asset, no unrelated character or extra objects. '
            +('Actual transparent alpha background. ' if job['transparent_background'] else 'Opaque background layer. ')
            +f'Target canvas {width}x{height}.\n\n'+job['prompt'])
