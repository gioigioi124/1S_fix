SET SAFETY OFF
SET TALK OFF
SET EXCLUSIVE ON

USE e:\1S2024\FRM\ctbhch.scx IN 0 ALIAS ctbhch_scx EXCLUSIVE
SELECT ctbhch_scx
PACK
USE IN ctbhch_scx
COMPILE FORM e:\1S2024\FRM\ctbhch.scx
MESSAGEBOX('PACK and COMPILE ctbhch.scx completed!', 0+64, '1S2024')
RETURN
