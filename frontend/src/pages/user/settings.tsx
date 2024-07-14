import {
    Center,
    VStack,
    Heading,
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabPanels,
} from "@chakra-ui/react";
import { BaseLayout } from "../../components/shared/layout/BaseLayout";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faHashtag,
    faPeopleGroup,
    faSkull,
} from "@fortawesome/free-solid-svg-icons";
import { UpdateUserProfileForm } from "../../components/settings/profile/UpdateUserProfileForm";
import { AuthProtectedBaseLayout } from "../../components/shared/layout/AuthProtectedBaseLayout";
import { ChessBoardBackground } from "../../components/shared/chess-board-background/ChessBoardBackground";
import { textShadowStyle } from "../../lib/chakra";
import { SocialLogins } from "../../components/settings/profile/SocialLogins";

export function SettingsPage() {
    return (
        <AuthProtectedBaseLayout>
            <SettingsContent />
        </AuthProtectedBaseLayout>
    );
}

function SettingsContent() {
    return (
        <BaseLayout>
            <Center
                py="2rem"
                px="1rem"
                pos="relative"
                overflowX="hidden"
                overflowY="hidden"
                as="main"
            >
                <VStack
                    w="100%"
                    maxW="700px"
                    as="main"
                    alignItems="start"
                    gap="1rem"
                    zIndex={10}
                >
                    <Heading
                        fontFamily="cubano"
                        as="h1"
                        letterSpacing="1px"
                        fontSize={{ base: "2.5rem", md: "3.5rem" }}
                        css={textShadowStyle}
                    >
                        Settings
                    </Heading>

                    <Tabs w="100%" isLazy isFitted>
                        <TabList
                            pb="1rem"
                            borderBottom="1px solid"
                            borderColor="gray.600"
                            w="100%"
                            h="60px"
                        >
                            <Tab>
                                <FontAwesomeIcon icon={faSkull} size="sm" />
                                Profile
                            </Tab>

                            <Tab>
                                <FontAwesomeIcon icon={faHashtag} size="sm" />
                                Socail Login
                            </Tab>
                        </TabList>

                        <TabPanels>
                            <TabPanel>
                                <UpdateUserProfileForm />
                            </TabPanel>

                            <TabPanel>
                                <SocialLogins />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </VStack>

                <ChessBoardBackground h="140px" />
            </Center>
        </BaseLayout>
    );
}
