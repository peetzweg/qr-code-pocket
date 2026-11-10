import plistlib, uuid, sys
url = sys.argv[1]
out = sys.argv[2]
gid = str(uuid.uuid4()).upper()
tok = lambda v: {"Value": v, "WFSerializationType": "WFTextTokenAttachment"}
wf = {
  "WFWorkflowClientVersion": "3218.0.4",
  "WFWorkflowMinimumClientVersion": 900,
  "WFWorkflowMinimumClientVersionString": "900",
  "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4282601983, "WFWorkflowIconGlyphNumber": 59511},
  "WFWorkflowTypes": ["ActionExtension"],
  "WFWorkflowInputContentItemClasses": ["WFImageContentItem", "WFPDFContentItem", "WFGenericFileContentItem"],
  "WFWorkflowOutputContentItemClasses": [],
  "WFWorkflowHasShortcutInputVariables": True,
  "WFWorkflowImportQuestions": [],
  "WFQuickActionSurfaces": [],
  "WFWorkflowActions": [
    {"WFWorkflowActionIdentifier": "is.workflow.actions.repeat.each",
     "WFWorkflowActionParameters": {"GroupingIdentifier": gid, "WFControlFlowMode": 0, "WFInput": tok({"Type": "ExtensionInput"})}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
     "WFWorkflowActionParameters": {"WFURL": url, "WFHTTPMethod": "POST", "WFHTTPBodyType": "File", "ShowHeaders": False,
                                    "WFRequestVariable": tok({"Type": "Variable", "VariableName": "Repeat Item"})}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.repeat.each",
     "WFWorkflowActionParameters": {"GroupingIdentifier": gid, "WFControlFlowMode": 2}},
    {"WFWorkflowActionIdentifier": "is.workflow.actions.notification",
     "WFWorkflowActionParameters": {"WFNotificationActionTitle": "QR Code Pocket", "WFNotificationActionBody": "Added. Open QR Code Pocket to file it.", "WFNotificationActionSound": False}},
  ],
}
with open(out, "wb") as f: plistlib.dump(wf, f, fmt=plistlib.FMT_BINARY)
print("built", out)
