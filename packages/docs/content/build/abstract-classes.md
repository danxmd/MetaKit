---
id: abstract-classes
title: Abstract classes and inheritance
category: build
summary: A class can extend a parent class to inherit its attributes, and a parent can be abstract so that it only exists to share things.
keywords: [abstract class, inheritance, extends, parent class, subclass, inherited attributes]
contexts: []
order: 60
---

Inheritance lets one class build on another. A **child** class has everything its **parent** has and adds its own. An **abstract** class is a parent that cannot be placed on the canvas by itself.

## What it is

When class B extends class A:

- B has all attributes of A first, then its own. Modellers see them in that order.
- B counts as an A wherever the Kit asks for an A. A relation class that allows A at one end also allows B. A model type that allows A also allows B. A reference attribute that may point to A may point to B.
- B can add attributes, constraints and a look of its own.

Relation classes can extend each other in the same way ([[relations]]).

An abstract class is only a base. The palette does not offer it and the app refuses to create an object of it with the message: The class "Actor" is abstract, so elements of it cannot be created. Create one of its subclasses instead.

## Where to find it

In the **Identity** block of a class: the **Extends** list and the **Abstract (only for others to extend)** checkbox ([[classes]]). Relation classes have the same two controls.

## How to use it

1. Create the parent first, for example **Actor**, with the shared attributes **Name**, **Role** and **Notes**.
2. Tick **Abstract (only for others to extend)** if nobody should create plain Actors. The class then shows an **Abstract** badge in its heading.
3. Create the children, for example **Agent** and **Human**.
4. On each child, choose the parent in **Extends**.
5. Add the attributes that only the child needs.
6. In a relation class, allow the parent at the end ([[relations]]). Both children are then allowed.

## Every option explained

| Control | What it does |
| --- | --- |
| **Extends** | Chooses the parent. **Nothing** removes it. The list offers every class except the class itself and classes that extend it (directly or further down), so a loop cannot be made. |
| **Abstract (only for others to extend)** | Marks the class as a base. Untick it to allow plain objects again. |

### What a child gets

- **Attributes.** The child list shows only the child's own attributes. The inherited ones are in the parent. Everywhere else (the attribute panel, formulas, looks, panel layouts) the child has both.
- **Keys.** An attribute key must be unique across the whole family: the class, its parents and its children. If a child tries to add `Name` and the parent already has it, the app says: The key "Name" is already used by an attribute of "Agent" or a parent. And if a parent adds a key that a child already uses: The key "Role" is already used by an attribute of "Agent", which extends "Actor".
- **Looks.** Each class has its own look. A child does not inherit the parent's look.
- **Constraints.** Constraints belong to the class they are defined on.
- **Panel layouts.** A panel layout belongs to one class. Attributes inherited from the parent can be placed in the child's layout.

### What allows what

| Place | Rule |
| --- | --- |
| Model type | A class is allowed when it or any of its parents is ticked in **Classes allowed in the model**. |
| Relation class end | **From** and **To** allow the listed classes and all their children. |
| Palette | Abstract classes are left out; their concrete children are offered. |
| View | A view that lists an abstract class brings in its concrete children. |

## Examples

In the Agent pipeline Kit, **Actor** is abstract and owns **Name** (required, default "New actor"), **Role** and **Notes**. **Agent** extends Actor and adds the group Agent: AgentKind, Autonomy, ModelName, CostLimit and Capabilities. **Human** extends Actor and adds Team and Availability. The relation class **Performs** allows only **Actor** at From, so Agent and Human can both perform a Task, and **DelegatesTo** goes from Actor to Actor.

## Good to know

- You can extend a class that is itself a child. The family can be several levels deep.
- Deleting a parent is refused while a child extends it: class "Agent" extends it.
- If a file is edited by hand and two classes extend each other, validation reports: The classes "A" and "B" extend each other in a loop. The Build editor itself will not let you create one.
- Changing the parent of a class that already has objects is safe. Values for attributes that vanish from the family stay in the models as unknown attributes.

> **Tip**
> Make a class abstract when you find yourself copying attributes between classes. Put the shared ones in an abstract parent instead.

## Related

[[classes]], [[relations]], [[attributes]], [[model-types]], [[keys-and-renaming]], [[kit-validation]]
