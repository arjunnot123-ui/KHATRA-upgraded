// Each scenario maps to one of the 5 safety domains named in the SIH CY-1
// problem statement. `domain` is the official domain label; `id` and
// `sector` are used for routing/display. A 6th bonus module (manual
// handling) goes beyond the minimum "at least two modules" requirement.

export const SCENARIOS = [
  {
    id: 'fire-explosion',
    domain: 'Fire & Explosion Response',
    sector: 'Steel Plant',
    title: 'Fire & Explosion Response',
    intro:
      'A spark from a grinding operation near a fuel storage area has ignited a small fire on the steel plant floor. You are the nearest worker.',
    steps: [
      {
        id: 'fe1',
        prompt: 'You spot the fire. What is your first action?',
        choices: [
          { text: 'Try to put it out yourself with whatever is nearby', points: -20, feedback: 'Acting without identifying the fire type or your nearest exit first risks trapping you. Always confirm your evacuation route before engaging any fire.' },
          { text: 'Identify your nearest marked exit, then raise the alarm', points: 20, feedback: 'Correct. Exit identification comes first — you can only fight a fire safely if your escape route is confirmed and clear.' },
        ],
      },
      {
        id: 'fe2',
        prompt: 'The fire is small, contained to a waste bin, and you are trained on extinguisher use. Which extinguisher do you grab?',
        choices: [
          { text: 'Any extinguisher within reach', points: -15, feedback: 'Using the wrong extinguisher class on a fuel or electrical fire can make it worse — water on an oil fire, for example, spreads flame violently.' },
          { text: 'Check the label for the correct class (e.g. CO2/foam for flammable liquid) before using it', points: 20, feedback: 'Correct. Confirming the extinguisher class takes two seconds and prevents turning a small fire into a major one.' },
        ],
      },
      {
        id: 'fe3',
        prompt: 'The fire suddenly grows and black smoke fills the area. What now?',
        choices: [
          { text: 'Keep trying to extinguish it since you already started', points: -30, feedback: 'Once a fire exceeds what a handheld extinguisher can control, continuing to fight it risks your life. Evacuation always overrides firefighting at this point.' },
          { text: 'Abandon extinguishing, follow the evacuation sequence, and account for your team at the muster point', points: 30, feedback: 'Correct. Evacuation sequencing — stop, exit via the nearest safe route, report to muster point — is the standard protocol once a fire escalates.' },
        ],
      },
      {
        id: 'fe4',
        prompt: 'The fire alarm sounds while you are mid-task on a machine. What do you do?',
        choices: [
          { text: 'Finish the task quickly, then head to the exit', points: -20, feedback: 'Any delay during an active alarm costs you evacuation time you may not get back. The alarm means leave now, not "after this last step."' },
          { text: 'Stop immediately, leave the equipment in a safe state if it takes only a second, and evacuate', points: 20, feedback: 'Correct. Stop work the moment the alarm sounds — evacuation always takes priority over finishing a task.' },
        ],
      },
      {
        id: 'fe5',
        prompt: 'You reach the muster point after evacuating. What should you do?',
        choices: [
          { text: 'Slip back to check on your workstation once things look calm', points: -20, feedback: 'Re-entering before an all-clear is given is one of the most common causes of injury during fire emergencies — the area is not confirmed safe yet.' },
          { text: 'Report to your supervisor and remain until headcount is confirmed complete', points: 20, feedback: 'Correct. Muster-point headcount confirms everyone is accounted for — staying put until cleared is mandatory.' },
        ],
      },
      {
        id: 'fe6',
        prompt: 'During evacuation, you see a colleague heading for the elevator to save time.',
        choices: [
          { text: 'Join them — it is faster than the stairs', points: -25, feedback: 'Elevators can fail, lose power, or open onto a smoke-filled floor during a fire. They must never be used for fire evacuation.' },
          { text: 'Stop them and redirect both of you to the stairs', points: 25, feedback: 'Correct. Stairs are the only safe evacuation route during a fire — elevators are off-limits without exception.' },
        ],
      },
      {
        id: 'fe7',
        prompt: 'You notice a fire extinguisher near your station with an expired or missing inspection tag.',
        choices: [
          { text: 'Ignore it — it probably still works', points: -15, feedback: 'An unverified extinguisher may have lost pressure or malfunctioned. Trusting it in a real emergency is a gamble you should not take.' },
          { text: 'Report it immediately so it can be inspected or replaced', points: 15, feedback: 'Correct. Extinguishers must be current on inspection to be trusted — report any expired or missing tag right away.' },
        ],
      },
      {
        id: 'fe8',
        prompt: 'You are transferring flammable liquid between drums, which can build up static electricity.',
        choices: [
          { text: 'Go ahead without a grounding strap since it is a quick job', points: -25, feedback: 'Static discharge during liquid transfer is a well-known ignition source for explosions. Skipping grounding "just this once" is exactly how these incidents happen.' },
          { text: 'Attach a bonding/grounding strap between containers before starting the transfer', points: 25, feedback: 'Correct. Bonding and grounding equalizes static charge and is mandatory before transferring flammable liquids.' },
        ],
      },
      {
        id: 'fe9',
        prompt: 'You are the first to notice smoke but cannot tell exactly where the fire is.',
        choices: [
          { text: 'Head further into the smoke to try to locate the source', points: -30, feedback: 'Searching for a fire source yourself risks smoke inhalation and getting trapped. That is what trained responders are for.' },
          { text: 'Raise the alarm immediately and let trained responders investigate', points: 30, feedback: 'Correct. Report smoke immediately rather than investigating it yourself — early alarm gives responders the best chance to contain it.' },
        ],
      },
      {
        id: 'fe10',
        prompt: 'A small fire has just been extinguished and the area looks clear. What is the required next step?',
        choices: [
          { text: 'Resume work right away since the fire is out', points: -20, feedback: 'A fire that "looks out" can still have hidden hot spots or damaged equipment. Resuming work before a formal clearance risks re-ignition or hidden hazards.' },
          { text: 'Wait for the area to be inspected and cleared by a safety officer before resuming operations', points: 20, feedback: 'Correct. Formal clearance after a fire confirms there is no re-ignition risk or hidden damage before work resumes.' },
        ],
      },
    ],
  },
  {
    id: 'gas-leak-confined-space',
    domain: 'Gas Leak & Confined Space Protocol',
    sector: 'Mining',
    title: 'Gas Leak & Confined Space Protocol',
    intro:
      'You are about to enter a confined underground shaft in a Jharkhand coal mine to inspect a suspected gas leak. Protocol requires a hazard check before entry.',
    steps: [
      {
        id: 'gc1',
        prompt: 'Before entry, your gas detector shows a low-battery warning. What do you do?',
        choices: [
          { text: 'Enter anyway, the reading still seems to work', points: -20, feedback: 'A malfunctioning gas detector cannot be trusted in a confined space — methane and CO buildup are silent killers. Hazard zone recognition depends entirely on working equipment.' },
          { text: 'Report it and swap for a fully charged detector before entry', points: 20, feedback: 'Correct. Confirming hazard zone readings with reliable equipment is the first step of confined space protocol.' },
        ],
      },
      {
        id: 'gc2',
        prompt: 'The detector confirms elevated gas levels in the shaft. What PPE do you select before entry?',
        choices: [
          { text: 'A standard dust mask, since it is quick to put on', points: -25, feedback: 'A dust mask does not filter gas. Selecting the wrong PPE for a confirmed gas hazard is one of the most dangerous mistakes in confined space work.' },
          { text: 'A self-contained breathing apparatus (SCBA) or gas-rated respirator rated for the confirmed gas', points: 25, feedback: 'Correct. PPE selection must match the specific hazard — gas-rated respiratory protection is mandatory once elevated gas is confirmed.' },
        ],
      },
      {
        id: 'gc3',
        prompt: 'You are ready to enter the confined space. Your usual buddy is on a break.',
        choices: [
          { text: 'Enter alone since it will only take a few minutes', points: -30, feedback: 'Confined space entry alone is a critical violation. If you are overcome by gas, no one will know until it is too late — the buddy system exists specifically for this scenario.' },
          { text: 'Wait for a buddy or assign a stand-by attendant before entry', points: 30, feedback: 'Correct. The buddy system is mandatory for confined space entry — a second person monitoring from outside can call for rescue immediately if something goes wrong.' },
        ],
      },
      {
        id: 'gc4',
        prompt: 'You smell a faint gas odor entering a regular (non-confined) work area.',
        choices: [
          { text: 'Ignore it since it is only faint', points: -20, feedback: 'Even a faint gas smell can indicate a developing leak. Waiting for it to get stronger before acting delays the response you need.' },
          { text: 'Report it immediately and evacuate the area until it is cleared', points: 20, feedback: 'Correct. Any detectable gas odor should be reported and the area evacuated until it is confirmed safe.' },
        ],
      },
      {
        id: 'gc5',
        prompt: 'Your team is ready at the confined space entrance, but the entry permit has not yet been signed by your supervisor.',
        choices: [
          { text: 'Proceed anyway since the team is ready and briefed', points: -25, feedback: 'A signed entry permit confirms every safety check has been formally verified. Proceeding without it skips that final safeguard.' },
          { text: 'Wait until the permit is signed before entry begins', points: 25, feedback: 'Correct. No confined space entry should begin before the permit is formally signed off.' },
        ],
      },
      {
        id: 'gc6',
        prompt: 'While working inside the confined space, your gas monitor suddenly starts alarming.',
        choices: [
          { text: 'Keep working for a few more minutes to finish the task', points: -30, feedback: 'A gas alarm means conditions have become dangerous right now. Finishing "just a few more minutes" has cost lives in real confined space incidents.' },
          { text: 'Exit the confined space immediately, per protocol', points: 30, feedback: 'Correct. An active gas alarm requires immediate exit — no task is worth continuing through it.' },
        ],
      },
      {
        id: 'gc7',
        prompt: 'The ventilation blower supplying fresh air to the confined space stops working mid-task.',
        choices: [
          { text: 'Continue working since the air seemed fine a few minutes ago', points: -25, feedback: 'Air quality in a confined space can change fast once ventilation stops. Past readings do not guarantee current safety.' },
          { text: 'Stop work, exit, and restore ventilation before continuing', points: 25, feedback: 'Correct. Work must pause until forced ventilation is confirmed working again.' },
        ],
      },
      {
        id: 'gc8',
        prompt: 'You are the stand-by attendant outside, and radio contact with the entrant is lost for two minutes.',
        choices: [
          { text: 'Wait a bit longer, assuming the radio is just glitching', points: -30, feedback: 'Lost communication in a confined space is treated as an emergency until proven otherwise — waiting costs critical rescue time.' },
          { text: 'Initiate the emergency rescue procedure immediately', points: 30, feedback: 'Correct. Any loss of communication with an entrant triggers immediate rescue procedures — never assume it is a minor glitch.' },
        ],
      },
      {
        id: 'gc9',
        prompt: 'The entry team took a short break outside and now wants to re-enter without retesting the atmosphere.',
        choices: [
          { text: 'Skip the retest to save time — nothing should have changed', points: -20, feedback: 'Atmospheric conditions in a confined space can change even during a short break. Skipping the retest removes your only current safety check.' },
          { text: 'Retest the atmosphere before allowing re-entry', points: 20, feedback: 'Correct. Every re-entry after leaving the space requires a fresh atmospheric test, no matter how short the break was.' },
        ],
      },
      {
        id: 'gc10',
        prompt: 'You notice a coworker about to attempt confined space entry without the required certification.',
        choices: [
          { text: 'Let them proceed since they seem experienced', points: -25, feedback: 'Experience is not a substitute for certification — confined space entry training covers hazards that casual experience does not.' },
          { text: 'Stop them and confirm they complete required training and certification first', points: 25, feedback: 'Correct. No one may enter a confined space without the required certification, regardless of how experienced they appear.' },
        ],
      },
    ],
  },
  {
    id: 'machinery-safety',
    domain: 'Machinery Safety & Lockout-Tagout',
    sector: 'Manufacturing',
    title: 'Machinery Safety & Lockout-Tagout',
    intro:
      'You are operating a hydraulic metal press on a steel fabrication line. Your shift has just started.',
    steps: [
      {
        id: 'ms1',
        prompt: 'You notice the machine guard on the press has been removed for "faster access."',
        choices: [
          { text: 'Use the machine without the guard to save time', points: -25, feedback: 'Machine guards exist specifically to prevent crush injuries. Operating without one is one of the most common causes of factory-floor amputations.' },
          { text: 'Refuse to operate until the guard is reinstalled', points: 25, feedback: 'Correct. Never operate unguarded machinery — reinstalling safety guards is a prerequisite, not optional.' },
        ],
      },
      {
        id: 'ms2',
        prompt: 'The press jams mid-cycle and needs to be cleared. What do you do?',
        choices: [
          { text: 'Reach in quickly while the machine is still powered, since it looks stopped', points: -30, feedback: 'A machine that "looks stopped" can still cycle unexpectedly. Reaching into unlocked machinery is a leading cause of severe crush and amputation injuries.' },
          { text: 'Follow lockout-tagout procedure — power down, lock the isolator, tag it, then clear the jam', points: 30, feedback: 'Correct. Lockout-tagout (LOTO) ensures machinery cannot re-energize while you are clearing it — this is mandatory before any maintenance or unjamming task.' },
        ],
      },
      {
        id: 'ms3',
        prompt: 'A colleague asks you to help lift a heavy metal sheet using an improper bent-back posture.',
        choices: [
          { text: 'Lift it quickly the way they suggest', points: -15, feedback: 'Improper lifting posture is a leading cause of long-term spinal injury in manufacturing workers.' },
          { text: 'Suggest proper lifting technique or use lifting equipment', points: 15, feedback: 'Correct. Bend at the knees, keep the load close, or use mechanical aids — this prevents chronic injuries.' },
        ],
      },
      {
        id: 'ms4',
        prompt: 'You finish maintenance on a locked-out machine and are about to remove your personal lock.',
        choices: [
          { text: 'Remove your lock and let the next person deal with restarting it', points: -15, feedback: 'Removing your lock without confirming the area is clear risks someone starting the machine while another worker or tool is still in a dangerous position.' },
          { text: 'Verify the area is clear and all tools are removed before taking your lock off', points: 20, feedback: 'Correct. Always confirm the machine is safe to restart before removing your personal lockout lock.' },
        ],
      },
      {
        id: 'ms5',
        prompt: 'You notice a coworker\'s lockout lock is missing from a machine they were servicing.',
        choices: [
          { text: 'Assume they finished and are done — restart the machine', points: -30, feedback: 'A missing lock does not confirm the work is finished. Restarting without locating the worker risks a severe injury if they are still inside the machine.' },
          { text: 'Do not restart the machine — locate the coworker and confirm their status first', points: 30, feedback: 'Correct. Never restart a machine when you cannot confirm the servicing worker is fully clear — find them first.' },
        ],
      },
      {
        id: 'ms6',
        prompt: 'You need to make a quick adjustment to a conveyor belt that is still running.',
        choices: [
          { text: 'Reach in while it is running to save time', points: -30, feedback: 'Reaching into a running conveyor is one of the most common causes of severe hand and arm injuries on a factory floor.' },
          { text: 'Power down and follow lockout procedure before making any adjustment', points: 30, feedback: 'Correct. Any adjustment to moving machinery requires lockout first — there is no "quick and safe" exception.' },
        ],
      },
      {
        id: 'ms7',
        prompt: 'You notice a safety interlock on a machine appears to be bypassed with tape.',
        choices: [
          { text: 'Use the machine as usual — it still seems to work', points: -25, feedback: 'A bypassed interlock means the machine\'s built-in protection against accidental operation is disabled. Using it anyway removes a critical safety layer.' },
          { text: 'Report the tampered interlock immediately and do not operate the machine', points: 25, feedback: 'Correct. A bypassed safety interlock must be reported and fixed before the machine is used again.' },
        ],
      },
      {
        id: 'ms8',
        prompt: 'The safety glasses and gloves required for this machine are not available at your station.',
        choices: [
          { text: 'Operate without them just this once', points: -20, feedback: 'Skipping required PPE "just once" is how eye and hand injuries happen — the requirement does not have exceptions for convenience.' },
          { text: 'Request the PPE and wait until it is issued before operating', points: 20, feedback: 'Correct. Required PPE must be on hand before operating the machine, no exceptions.' },
        ],
      },
      {
        id: 'ms9',
        prompt: 'A new trainee asks you how to safely clear a machine jam.',
        choices: [
          { text: 'Show them a quicker unofficial way you sometimes use', points: -25, feedback: 'Teaching a shortcut that skips lockout-tagout passes the risk on to someone with even less experience than you.' },
          { text: 'Walk them through the full lockout-tagout procedure correctly', points: 25, feedback: 'Correct. Training a new worker is exactly when correct procedure matters most — never model a shortcut.' },
        ],
      },
      {
        id: 'ms10',
        prompt: 'Your shift is ending and the machine you operated is still running as the next shift arrives.',
        choices: [
          { text: 'Leave without briefing the next operator', points: -15, feedback: 'Handover gaps are a common source of accidents — the incoming operator needs to know about any issues from your shift.' },
          { text: 'Hand over the machine\'s status and any known issues to the incoming operator', points: 15, feedback: 'Correct. A proper shift handover, including any known issues, keeps the next operator safe.' },
        ],
      },
    ],
  },
  {
    id: 'electrical-hazard',
    domain: 'Electrical Hazard Response',
    sector: 'Manufacturing',
    title: 'Electrical Hazard Response',
    intro: 'You are doing a routine floor walk near the plant\'s main electrical distribution panel.',
    steps: [
      {
        id: 'eh1',
        prompt: 'You notice a frayed, exposed wire running across a walkway near the panel.',
        choices: [
          { text: 'Step over it carefully and continue on', points: -25, feedback: 'An exposed live wire is a shock and fire hazard for everyone who walks that path after you, not just you. Stepping over it does not make it safe.' },
          { text: 'Cordon off the area, de-energize if trained to, and report it immediately', points: 25, feedback: 'Correct. Exposed wiring must be isolated from foot traffic and reported for repair right away.' },
        ],
      },
      {
        id: 'eh2',
        prompt: 'A technician needs to service equipment connected to this panel. What is required before they start?',
        choices: [
          { text: 'They can start immediately since they are experienced', points: -25, feedback: 'Experience does not replace lockout-tagout. Skipping isolation before electrical maintenance is how experienced technicians get seriously injured.' },
          { text: 'The circuit must be locked out, tagged, and tested dead before any work begins', points: 25, feedback: 'Correct. Lockout-tagout plus a dead-test confirmation is mandatory before touching any electrical equipment for maintenance.' },
        ],
      },
      {
        id: 'eh3',
        prompt: 'You smell a faint burning odor coming from the panel area.',
        choices: [
          { text: 'Keep working, someone else will notice eventually', points: -30, feedback: 'A burning smell near electrical equipment is an early fire warning sign. Delayed reporting can lead to a major electrical fire.' },
          { text: 'Stop work, report it, and alert the fire safety team', points: 30, feedback: 'Correct. Early reporting of electrical burning smells is critical fire-prevention behavior.' },
        ],
      },
      {
        id: 'eh4',
        prompt: 'You need to plug in equipment near a floor area that looks slightly damp.',
        choices: [
          { text: 'Plug it in as usual — it does not look too wet', points: -20, feedback: 'Even a slightly damp floor near a power outlet creates a real shock risk. "Doesn\'t look too wet" is not a safety check.' },
          { text: 'Dry the area or use a GFCI-protected outlet before connecting anything', points: 20, feedback: 'Correct. Moisture near electrical connections requires drying the area or using ground-fault protection before use.' },
        ],
      },
      {
        id: 'eh5',
        prompt: 'An extension cord is daisy-chained through several outlets to reach a distant machine.',
        choices: [
          { text: 'Leave it — it seems to work fine', points: -20, feedback: 'Daisy-chained cords can overload circuits and overheat, creating a fire hazard even if they "seem" fine in the moment.' },
          { text: 'Replace it with a single properly rated cord or authorized wiring', points: 20, feedback: 'Correct. Daisy-chaining extension cords should be replaced with correctly rated wiring for the load.' },
        ],
      },
      {
        id: 'eh6',
        prompt: 'An untrained coworker asks for your help with a task inside an electrical panel.',
        choices: [
          { text: 'Help them since the supervisor is busy right now', points: -25, feedback: 'Assisting with electrical panel work without proper certification puts both of you at serious risk, regardless of the time pressure.' },
          { text: 'Decline and get a certified electrician or trained personnel instead', points: 25, feedback: 'Correct. Electrical panel work must go through certified, trained personnel only.' },
        ],
      },
      {
        id: 'eh7',
        prompt: 'A circuit breaker on a machine you are using keeps tripping repeatedly.',
        choices: [
          { text: 'Keep resetting it and continue working', points: -25, feedback: 'A breaker that trips repeatedly is signaling a real fault. Repeatedly resetting it instead of investigating is a common cause of electrical fires.' },
          { text: 'Stop using the machine and report it for inspection', points: 25, feedback: 'Correct. Repeated tripping means something is wrong — get it inspected before continuing to use the equipment.' },
        ],
      },
      {
        id: 'eh8',
        prompt: 'You notice water pooling on the floor near an electrical panel after a leak.',
        choices: [
          { text: 'Step around it and continue working nearby', points: -25, feedback: 'Water near a live electrical panel is a serious shock hazard for anyone in the area, not just you.' },
          { text: 'Cordon off the area, de-energize if trained to, and report it immediately', points: 25, feedback: 'Correct. Water near electrical equipment requires immediate isolation and reporting.' },
        ],
      },
      {
        id: 'eh9',
        prompt: 'A portable power tool you are using has a visibly damaged or frayed cord.',
        choices: [
          { text: 'Tape over the damaged spot and keep using it', points: -20, feedback: 'Tape does not restore proper insulation. A damaged cord remains a shock and fire risk even after being taped over.' },
          { text: 'Tag it out of service and get it repaired or replaced', points: 20, feedback: 'Correct. Damaged cords must be tagged out and repaired or replaced, not patched with tape.' },
        ],
      },
      {
        id: 'eh10',
        prompt: 'You are asked to work on equipment that a coworker says is "de-energized," but you have not personally verified it.',
        choices: [
          { text: 'Trust their word and start working', points: -30, feedback: 'Never rely on someone else\'s word that a circuit is dead. Verifying zero energy yourself is a core rule of electrical safety.' },
          { text: 'Test the circuit yourself to confirm zero energy before touching it', points: 30, feedback: 'Correct. Always personally verify a circuit is de-energized before starting work — this is non-negotiable.' },
        ],
      },
    ],
  },
  {
    id: 'dust-respiratory',
    domain: 'Dust & Respiratory Hazard Protection',
    sector: 'Mica Mining',
    title: 'Dust & Respiratory Hazard Protection',
    intro:
      'You are working in a mica processing unit where fine mineral dust is a constant part of the job. Long-term exposure without protection can cause silicosis and other lung disease.',
    steps: [
      {
        id: 'dr1',
        prompt: 'You are about to start a shift splitting mica sheets, which generates fine dust. What PPE do you select?',
        choices: [
          { text: 'A cloth covering over your nose and mouth, since it is what is available', points: -20, feedback: 'Cloth coverings do not filter fine mineral dust. This is exactly the kind of exposure that leads to silicosis over years of work.' },
          { text: 'A properly rated dust/respirator mask (N95 or better) approved for mineral dust', points: 20, feedback: 'Correct. Fine mica and silica dust requires a rated respirator — general cloth coverings offer no real protection.' },
        ],
      },
      {
        id: 'dr2',
        prompt: 'The work area floor is covered in settled dust and needs to be cleaned before shift change.',
        choices: [
          { text: 'Dry sweep it to clear it quickly', points: -25, feedback: 'Dry sweeping re-suspends fine dust into the air, increasing everyone\'s exposure. This is one of the most common dust-safety mistakes on a mica floor.' },
          { text: 'Use wet suppression or a vacuum with a dust filter', points: 25, feedback: 'Correct. Wet suppression keeps dust from becoming airborne again — dry sweeping should never be used in a high dust environment.' },
        ],
      },
      {
        id: 'dr3',
        prompt: 'A co-worker mentions they have had a persistent cough and shortness of breath for several weeks.',
        choices: [
          { text: 'Tell them it is probably nothing, dust exposure is normal in this job', points: -30, feedback: 'Normalizing respiratory symptoms delays diagnosis of silicosis and other occupational lung disease, which is far more treatable when caught early.' },
          { text: 'Encourage them to report it and get a medical check as per occupational health protocol', points: 30, feedback: 'Correct. Persistent respiratory symptoms in a dust environment should always be reported and medically checked — early detection saves lives.' },
        ],
      },
      {
        id: 'dr4',
        prompt: 'Your respirator\'s filter cartridge is past its rated use life.',
        choices: [
          { text: 'Keep using it — it still seems to filter fine', points: -20, feedback: 'A filter past its rated life no longer guarantees adequate protection, even if breathing still feels normal through it.' },
          { text: 'Replace it with a fresh, properly rated cartridge before continuing', points: 20, feedback: 'Correct. Filter cartridges must be replaced on schedule, not based on how they feel to breathe through.' },
        ],
      },
      {
        id: 'dr5',
        prompt: 'The ventilation or dust extraction system at your station is not running today.',
        choices: [
          { text: 'Work anyway — it is just for a short shift', points: -25, feedback: 'Even a short shift without dust extraction can mean significant airborne exposure, especially in mica processing work.' },
          { text: 'Report it and pause dust-generating work until ventilation is restored', points: 25, feedback: 'Correct. Dust-generating work should pause until extraction or ventilation is confirmed working.' },
        ],
      },
      {
        id: 'dr6',
        prompt: 'You are about to enter a high-dust zone and need to check your respirator seal.',
        choices: [
          { text: 'Skip the fit check — you have worn this respirator before', points: -20, feedback: 'A seal can fail from small changes each time you put it on. Skipping the fit check removes your only confirmation that it is sealed properly today.' },
          { text: 'Perform the seal/fit check every time before entry', points: 20, feedback: 'Correct. A fit check before every entry confirms the respirator is actually sealing against your face.' },
        ],
      },
      {
        id: 'dr7',
        prompt: 'A coworker has facial hair that may be breaking their respirator\'s seal.',
        choices: [
          { text: 'Let it go — not your responsibility', points: -15, feedback: 'A broken respirator seal means little to no real protection for that coworker, even though they appear to be wearing one.' },
          { text: 'Flag it, since facial hair compromises the seal and needs to be addressed', points: 15, feedback: 'Correct. A respirator only protects if it seals properly — facial hair interference should always be raised.' },
        ],
      },
      {
        id: 'dr8',
        prompt: 'You notice dust has visibly accumulated on overhead beams and equipment in the work area.',
        choices: [
          { text: 'Ignore it since it is not on the floor where people walk', points: -20, feedback: 'Accumulated dust overhead is both a respiratory hazard when disturbed and, in some materials, a fire or explosion risk.' },
          { text: 'Report it for proper cleanup', points: 20, feedback: 'Correct. Overhead dust accumulation should be reported and cleaned using proper methods, not left to build up.' },
        ],
      },
      {
        id: 'dr9',
        prompt: 'You are due for your periodic lung function or occupational health screening, but it is inconvenient this week.',
        choices: [
          { text: 'Postpone it indefinitely — you feel fine', points: -25, feedback: 'Occupational lung disease often has no symptoms until it is advanced. Feeling fine is not a substitute for screening.' },
          { text: 'Attend the screening as scheduled', points: 25, feedback: 'Correct. Periodic screening is how respiratory problems get caught early, well before symptoms would appear.' },
        ],
      },
      {
        id: 'dr10',
        prompt: 'A new dust-generating process is introduced at your station without an updated risk assessment.',
        choices: [
          { text: 'Proceed with your current PPE — it should be similar enough', points: -20, feedback: 'A new process can generate different dust types or higher concentrations than your current PPE was chosen for.' },
          { text: 'Request an updated exposure assessment before continuing', points: 20, feedback: 'Correct. Any new dust-generating process needs its own risk assessment before work continues.' },
        ],
      },
    ],
  },
  {
    id: 'warehouse-loading',
    domain: 'Manual Handling & Site Housekeeping',
    sector: 'Manufacturing',
    title: 'Warehouse & Loading Bay',
    intro:
      'You are working in a materials warehouse attached to the plant, coordinating forklift movement and stacked inventory during a busy shift.',
    steps: [
      {
        id: 'w1',
        prompt: 'A forklift is reversing near you with its warning beeper disabled because "it was too noisy."',
        choices: [
          { text: 'Continue walking through the area as usual', points: -25, feedback: 'A disabled reversing alarm removes the only warning pedestrians get. Struck-by-forklift incidents are a leading cause of warehouse fatalities.' },
          { text: 'Stop, report the disabled alarm, and avoid the forklift\'s path', points: 25, feedback: 'Correct. Reversing alarms must never be disabled — report it immediately and keep clear until it is fixed.' },
        ],
      },
      {
        id: 'w2',
        prompt: 'You see steel drums stacked three-high without any strapping, swaying slightly.',
        choices: [
          { text: 'Walk past quickly, it has been like that for days', points: -20, feedback: 'Unsecured stacked loads can topple with no warning. Normalizing a known hazard is exactly how warehouse crush injuries happen.' },
          { text: 'Cordon off the area and report it for proper restacking', points: 20, feedback: 'Correct. Unstable stacked loads must be secured or cordoned off immediately — this prevents crush injuries from a sudden collapse.' },
        ],
      },
      {
        id: 'w3',
        prompt: 'You need to reach a box on a high shelf and the only ladder nearby has a visibly cracked step.',
        choices: [
          { text: 'Use it carefully, just this once', points: -20, feedback: 'A cracked step can fail under any load, "careful" use included. Faulty equipment must be taken out of service, not worked around.' },
          { text: 'Tag it as damaged and get a proper ladder', points: 20, feedback: 'Correct. Damaged equipment should be tagged and removed from use immediately, not risked "just this once."' },
        ],
      },
      {
        id: 'w4',
        prompt: 'You need to lift a box that feels slightly too heavy to handle comfortably alone.',
        choices: [
          { text: 'Lift it alone quickly to get it done', points: -20, feedback: 'Pushing through a lift that feels too heavy is a common cause of back injuries — the discomfort is the warning sign.' },
          { text: 'Get a second person or use lifting equipment', points: 20, feedback: 'Correct. When a lift feels too heavy for one person, get help or mechanical assistance rather than pushing through it.' },
        ],
      },
      {
        id: 'w5',
        prompt: 'A walkway is partially blocked by loose cables running across the floor.',
        choices: [
          { text: 'Step over them and continue on', points: -15, feedback: 'Loose cables across a walkway are a trip hazard for everyone who passes, not just you — stepping over them once does not fix that.' },
          { text: 'Report it and get the cables taped down or rerouted out of the walkway', points: 15, feedback: 'Correct. Cables across a walkway should be secured or rerouted, not just stepped over.' },
        ],
      },
      {
        id: 'w6',
        prompt: 'You notice a spill of oil or liquid on the warehouse floor near a busy path.',
        choices: [
          { text: 'Walk around it and keep working — someone will clean it eventually', points: -20, feedback: 'A spill on a busy path is a slip hazard for everyone who walks it after you. "Someone will clean it" is not a plan.' },
          { text: 'Cordon it off and clean or report it immediately', points: 20, feedback: 'Correct. Spills on walkways should be contained and cleaned right away, not left for someone else to find.' },
        ],
      },
      {
        id: 'w7',
        prompt: 'You are asked to operate a forklift without formal certification, just this once.',
        choices: [
          { text: 'Do it — it looks simple enough', points: -30, feedback: 'Forklifts cause serious injuries in untrained hands even for what looks like a simple move. Certification exists because "looks simple" is deceptive.' },
          { text: 'Decline — only certified operators may run the forklift', points: 30, feedback: 'Correct. Forklift operation requires certification without exception, regardless of how quick or simple the task seems.' },
        ],
      },
      {
        id: 'w8',
        prompt: 'A stack of pallets is blocking a marked fire exit in the warehouse.',
        choices: [
          { text: 'Leave it — moving it is someone else\'s job', points: -25, feedback: 'A blocked fire exit puts everyone at risk during an emergency evacuation, regardless of whose job it was to stack the pallets.' },
          { text: 'Report or clear it immediately — exits must stay unobstructed', points: 25, feedback: 'Correct. Fire exits must always remain clear — this gets fixed immediately, not scheduled for later.' },
        ],
      },
      {
        id: 'w9',
        prompt: 'You are carrying a load that blocks your forward view.',
        choices: [
          { text: 'Continue walking normally, watching your feet', points: -20, feedback: 'Walking blind into a busy warehouse path risks colliding with people, forklifts, or obstacles you cannot see coming.' },
          { text: 'Get help or take a route with clear visibility instead', points: 20, feedback: 'Correct. Never carry a load that blocks your view — get assistance or choose a path where you can see clearly.' },
        ],
      },
      {
        id: 'w10',
        prompt: 'Your shift is ending and several tools and materials are left scattered around your station.',
        choices: [
          { text: 'Leave it for the next shift to sort out', points: -15, feedback: 'A cluttered station left for the next person increases trip and handling hazards right from the start of their shift.' },
          { text: 'Tidy your station before leaving, per housekeeping protocol', points: 15, feedback: 'Correct. End-of-shift housekeeping keeps the station safe for whoever works there next.' },
        ],
      },
    ],
  },
]

// The 5 domains required for full certification eligibility (matches the
// official problem statement's 5 named safety domains).
export const CERTIFICATION_DOMAINS = [
  'Fire & Explosion Response',
  'Gas Leak & Confined Space Protocol',
  'Machinery Safety & Lockout-Tagout',
  'Electrical Hazard Response',
  'Dust & Respiratory Hazard Protection',
]

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id)
}
