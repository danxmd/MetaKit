# Spec Delta

## ADDED Requirements

### Requirement: Export from the model view
The model view SHALL offer an Export menu on the toolbar with Image or PDF…, Model file (.mkmodel.json), Bundle with Kit (.mkbundle) and CSV files (.csv.zip), and the File menu SHALL list the same data exports beside Export as image or PDF…. A data export of the open model SHALL first write the edits still waiting to be saved, so that the file holds every change made before it. The view SHALL say when an export is done and, when it fails, why.

#### Scenario: Latest edit included
- **WHEN** the person renames an object and at once chooses **Export**, **Model file (.mkmodel.json)**
- **THEN** a file named after the model, ending in `.mkmodel.json`, is downloaded with the new name in it, and a message says "Exported the model file."

#### Scenario: Bundle and CSV
- **WHEN** the person chooses **Bundle with Kit (.mkbundle)** and then **CSV files (.csv.zip)**
- **THEN** a `.mkbundle` and a `.csv.zip` file are downloaded

#### Scenario: Image
- **WHEN** the person chooses **Export**, **Image or PDF…**
- **THEN** the export image dialog opens
