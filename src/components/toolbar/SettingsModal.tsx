import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Grid,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
  useToast,
  useDisclosure,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Input,
  Text,
} from '@chakra-ui/react';
import { useAtom } from 'jotai';
import { canvasObjects, customFonts as customFontsAtom } from 'gstates';
import { encode } from 'base64-arraybuffer';
import { fileToBase64 } from 'helpers/fileToBase64';
import { v4 as uuid } from 'uuid';
import { init, ttf2woff } from 'wasm-ttf2woff/dist/browser/ttf2woff';
import { useAtomValue, useUpdateAtom } from 'jotai/utils';
import { preventToolbar, preventCanvasShortcut } from 'gstates';
import cloneDeep from 'clone-deep';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isOpen }) => {
  const setPreventToolbar = useUpdateAtom(preventToolbar);
  const setPreventCanvasShortcut = useUpdateAtom(preventCanvasShortcut);
  const [isActve, setActive] = useState<'custom-fonts' | 'about'>('custom-fonts');

  useEffect(() => {
    init('/wasm/ttf2woff.wasm');
  }, []);

  useEffect(() => {
    setPreventToolbar(isOpen);
    setPreventCanvasShortcut(isOpen);
  }, [isOpen, setPreventCanvasShortcut, setPreventToolbar]);

  return (
    <Modal trapFocus={false} size="6xl" isCentered isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent height="80%">
        <ModalHeader fontSize="md">Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody p="0" fontSize="sm">
          <Grid h="100%" gridTemplateColumns="200px 1fr">
            <Box borderRight="1px solid" borderColor="blackAlpha.300">
              <SidebarItem
                isActive={isActve === 'custom-fonts'}
                onClick={() => setActive('custom-fonts')}
              >
                Custom Fonts
              </SidebarItem>
              <SidebarItem isActive={isActve === 'about'} onClick={() => setActive('about')}>
                About
              </SidebarItem>
            </Box>
            <Box px="3" pt="3" overflowY="auto">
              {isActve === 'custom-fonts' ? <CustomFontsSetting /> : null}
              {isActve === 'about' ? <AboutSetting /> : null}
            </Box>
          </Grid>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SettingsModal;

interface SidebarItemProps {
  isActive?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ isActive, children, onClick }) => {
  return (
    <Box
      background={isActive ? 'blue.200' : undefined}
      _hover={{ background: 'blue.200' }}
      cursor="pointer"
      pl="6"
      pr="3"
      py="1.5"
      fontWeight={isActive ? 'semibold' : undefined}
      onClick={onClick}
    >
      {children}
    </Box>
  );
};

const CustomFontsSetting = () => {
  const [customFonts, setCustomFonts] = useAtom(customFontsAtom);
  const setCObjects = useUpdateAtom(canvasObjects);
  const [file, setFile] = useState<File>();
  const [fontName, setFontName] = useState<string>('');
  const [format, setFormat] = useState<CustomFont['format']>('ttf');
  const { isOpen, onClose, onOpen } = useDisclosure();
  const {
    isOpen: isDeleteModalOpen,
    onClose: onDeleteModalClose,
    onOpen: onDeleteModalOpen,
  } = useDisclosure();
  const [idToDelete, setIdToDelete] = useState<string>('');
  const toast = useToast();

  const handleAddFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    const format = file.name.split('.')[1];

    if (!['otf', 'ttf'].includes(format)) {
      toast({
        title: 'Invalid file format. Only accept file with otf, ttf format.',
        status: 'error',
        position: 'top',
        duration: 3000,
      });
    }

    setFile(file);
    setFontName(file.name.split('.')[0]);
    setFormat(format as CustomFont['format']);
    onOpen();
    // clear input file
    const htmlInput = document.getElementById('addCustomFont') as HTMLInputElement;
    htmlInput.value = '';
  };

  const handleAddFont = async () => {
    if (!fontName || !file) return;

    const opentype = await fileToBase64(file);
    const ttfu8 = await ttf2woff(new Uint8Array(await file.arrayBuffer()));
    const blob = new Blob([ttfu8]);
    const webfont = `data:application/octet-stream;base64,${encode(await blob.arrayBuffer())}`;

    setCustomFonts([
      ...customFonts,
      {
        format,
        family: fontName,
        variants: [],
        kind: 'custom',
        files: { webfont, opentype },
        id: uuid(),
      },
    ]);
    onClose();
    toast({
      title: `${fontName} font successfully added`,
      status: 'success',
      position: 'top',
      duration: 3000,
    });
  };

  const handleDelete = () => {
    setCustomFonts((customFonts) => {
      const newCustomFonts = cloneDeep(customFonts);
      const font = newCustomFonts.find((val) => val.id === idToDelete);
      if (font) {
        const indexOf = newCustomFonts.indexOf(font);
        newCustomFonts.splice(indexOf, 1);
        setCObjects((cObjects) => {
          const newCObjects = cloneDeep(cObjects);
          Object.keys(cObjects).map((key) => {
            if (newCObjects[key].data.family === font.family) {
              newCObjects[key].data.family = 'Roboto';
              newCObjects[key].data.weight = '400';
            }
          });

          return newCObjects;
        });
      }

      return newCustomFonts;
    });

    onDeleteModalClose();
  };

  return (
    <>
      <Modal size="md" isCentered isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
        <ModalContent border="1px solid" borderColor="blackAlpha.400">
          <ModalHeader fontSize="md">Delete Font</ModalHeader>
          <ModalCloseButton />
          <ModalBody fontSize="sm">
            <Text>Are you sure you want to delete this font?</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onDeleteModalClose} mr="3" size="sm">
              Cancel
            </Button>
            <Button onClick={handleDelete} size="sm" variant="outline" colorScheme="red">
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal closeOnOverlayClick={false} size="md" isCentered isOpen={isOpen} onClose={onClose}>
        <ModalContent border="1px solid" borderColor="blackAlpha.400">
          <ModalHeader fontSize="md">Add Custom Fonts</ModalHeader>
          <ModalCloseButton />
          <ModalBody fontSize="sm">
            <FormControl isInvalid={!fontName} id="font-name" isRequired>
              <FormLabel>Font Name</FormLabel>
              <Input value={fontName} onChange={(e) => setFontName(e.target.value)} />
              <FormErrorMessage>Font name is required</FormErrorMessage>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} mr="3" size="sm" variant="outline" colorScheme="blackAlpha">
              Cancel
            </Button>
            <Button onClick={handleAddFont} size="sm" colorScheme="blue">
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Box>
        <Flex px="4" justifyContent="flex-start">
          <Box pos="relative">
            <input
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 0,
                height: 0,
                opacity: 0,
                userSelect: 'none',
              }}
              type="file"
              id="addCustomFont"
              onChange={handleAddFile}
              accept=".otf,.ttf"
            />
            <Button
              as="label"
              htmlFor="addCustomFont"
              cursor="pointer"
              w="150px"
              mb="4"
              colorScheme="blue"
              size="sm"
            >
              Add Font
            </Button>
          </Box>
        </Flex>
        <Table variant="simple">
          {customFonts.length > 0 ? (
            <TableCaption>Please upload only otf or ttf file format only!</TableCaption>
          ) : null}
          <Thead>
            <Tr>
              <Th>Fonts</Th>
              <Th>Format</Th>
              <Th textAlign="right"></Th>
            </Tr>
          </Thead>
          <Tbody>
            {customFonts.map(({ family, format, id }, i) => (
              <Tr key={id}>
                <Td>{family}</Td>
                <Td>{format}</Td>
                <Td isNumeric>
                  <Button
                    onClick={() => {
                      setIdToDelete(id);
                      onDeleteModalOpen();
                    }}
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                  >
                    Delete
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {customFonts.length === 0 ? (
          <Text textAlign="center" mt="6">
            You don&apos;t have any custom fonts yet. Have problem with adding font? We only accept
            otf or ttf file format 😉
          </Text>
        ) : null}
      </Box>
    </>
  );
};

const AboutSetting = () => (
  <Box>
    <Text mb="1" fontWeight="bold">
      App version:{' '}
    </Text>
    <Text mb="4">{import.meta.env.VITE_APP_VERSION}</Text>
    <Text mb="1" fontWeight="bold">
      Contact Support:{' '}
    </Text>
    <Text>
      <a href="mailto:certifast.app@gmail.com">certifast.app@gmail.com</a>
    </Text>
  </Box>
);
