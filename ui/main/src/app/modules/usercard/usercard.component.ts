/* Copyright (c) 2018-2022, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */

import {Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {UntypedFormControl, UntypedFormGroup} from '@angular/forms';
import {Store} from '@ngrx/store';
import {AppState} from '@ofStore/index';
import {CardService} from '@ofServices/card.service';
import {UserService} from '@ofServices/user.service';
import {Card, CardCreationReportData, CardData, fromCardToCardForPublishing, TimeSpan} from '@ofModel/card.model';
import {UserCard} from '@ofModel/processes.model';
import {Severity} from '@ofModel/light-card.model';
import {Guid} from 'guid-typescript';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {EntitiesService} from '@ofServices/entities.service';
import {ProcessesService} from '@ofServices/processes.service';
import {HandlebarsService} from '../cards/services/handlebars.service';
import {DetailContext} from '@ofModel/detail-context.model';
import {map} from 'rxjs/operators';
import {MessageLevel} from '@ofModel/message.model';
import {AlertMessageAction} from '@ofStore/actions/alert.actions';
import {ConfigService} from '@ofServices/config.service';
import {DisplayContext} from '@ofModel/templateGateway.model';
import {SoundNotificationService} from '@ofServices/sound-notification.service';
import {UserCardDatesFormComponent} from './datesForm/usercard-dates-form.component';
import {DateField, DatesForm} from './datesForm/dates-form.model';
import {UserCardRecipientsFormComponent} from './recipientForm/usercard-recipients-form.component';
import {UserPermissionsService} from '@ofServices/user-permissions.service';
import {Utilities} from '../../common/utilities';
import {UsercardSelectCardEmitterFormComponent} from './selectCardEmitterForm/usercard-select-card-emitter-form.component';
import {LogOption, OpfabLoggerService} from '@ofServices/logs/opfab-logger.service';
import {NgbDate} from '@ng-bootstrap/ng-bootstrap';
import {DateTimeNgb} from '@ofModel/datetime-ngb.model';

declare const templateGateway: any;
declare const usercardTemplateGateway: any;
@Component({
    selector: 'of-usercard',
    templateUrl: './usercard.component.html',
    styleUrls: ['./usercard.component.scss']
})
export class UserCardComponent implements OnInit {
    @Input() userCardModal;
    public pageLoading = true;

    // Process and state choice
    private selectedProcessId: string;
    private selectedStateId: string;
    private emptyProcessList = false;
    public userCardConfiguration: UserCard;

    // Severity
    private severityForm: UntypedFormGroup;
    public severityVisible = true;

    // Dates
    @ViewChild('datesForm') datesForm: UserCardDatesFormComponent;
    public datesFormValue: DatesForm;
    readonly defaultStartDate = new Date().valueOf() + 60000;
    readonly defaultEndDate = new Date().valueOf() + 60000 * 60 * 24;
    readonly defaultLttdDate = this.defaultEndDate - 60000;
    private startDateVisible = true;
    private endDateVisible = true;
    private lttdVisible = true;
    private currentStartDate = new Date().valueOf() + 60000;
    private currentEndDate = new Date().valueOf() + 60000 * 60 * 24;
    private currentLttd = this.defaultEndDate - 60000;

    public userEntitiesAllowedToSendCardOptions = [];

    // Card emitter
    @ViewChild('cardEmitterForm') cardEmitterForm: UsercardSelectCardEmitterFormComponent;

    // For recipients component
    public recipientVisible = true;
    @ViewChild('recipientsForm') recipientsForm: UserCardRecipientsFormComponent;
    public initialSelectedRecipients = [];

    // For edition mode
    @Input() cardIdToEdit: string = null;
    private editCardMode = false;
    private cardToEdit: CardData;
    public editCardProcessId: string;
    public editCardStateId: string;
    private datesFromCardToEdit: boolean;
    private datesFromTemplate: boolean;
    isLoadingCardTemplate = false;
    isPreparingCard = false;

    // Preview and send card
    readonly displayContext = DisplayContext.PREVIEW;
    private publisherForCreatingUsercard: string;
    public card: Card;
    public displayPreview = false;
    public displaySendingCardInProgress = false;
    private useDescriptionFieldForEntityList = false;
    private specificInformation = null;

    protected childCards: Card[] = [];

    public userCardTemplate: SafeHtml;

    constructor(
        private store: Store<AppState>,
        private cardService: CardService,
        private userService: UserService,
        private entitiesService: EntitiesService,
        private sanitizer: DomSanitizer,
        private element: ElementRef,
        private processesService: ProcessesService,
        protected configService: ConfigService,
        private handlebars: HandlebarsService,
        protected soundNotificationService: SoundNotificationService,
        protected userPermissionsService: UserPermissionsService,
        private opfabLogger: OpfabLoggerService
    ) {
        this.setDefaultDateFormValues();
    }

    ngOnInit() {
        const ngbDate = new NgbDate(2022, 7, 33);
        console.log('ngDate = ', ngbDate);
        const test = new DateTimeNgb(ngbDate, {
            hour: 0,
            minute: 0,
            second: 0
        });

        console.log('date = ', new Date(Utilities.convertNgbDateTimeToEpochDate(test)));

        this.pageLoading = true;
        this.datesFromTemplate = true;
        usercardTemplateGateway.initUsercardTemplateGateway();
        this.severityForm = new UntypedFormGroup({
            severity: new UntypedFormControl('')
        });
        this.severityForm.get('severity').setValue(Severity.ALARM);

        this.userEntitiesAllowedToSendCardOptions = this.findUserEntitiesAllowedToSendCard();
        this.userEntitiesAllowedToSendCardOptions.sort((a, b) => Utilities.compareObj(a.label, b.label));

        if (!!this.cardIdToEdit) {
            usercardTemplateGateway.editionMode = 'EDITION';
            this.loadCardForEdition();
        } else {
            usercardTemplateGateway.editionMode = 'CREATE';
            this.pageLoading = false;

            if (this.userEntitiesAllowedToSendCardOptions.length > 0) {
                this.publisherForCreatingUsercard = this.userEntitiesAllowedToSendCardOptions[0].value;
            }
        }

        this.useDescriptionFieldForEntityList = this.configService.getConfigValue(
            'usercard.useDescriptionFieldForEntityList',
            false
        );
    }

    private loadCardForEdition() {
        this.editCardMode = true;
        this.cardService.loadCard(this.cardIdToEdit).subscribe((card) => {
            this.cardToEdit = card;
            this.editCardProcessId = this.cardToEdit.card.process;
            this.editCardStateId = this.cardToEdit.card.state;
            this.severityForm.get('severity').setValue(this.cardToEdit.card.severity);
            this.initialSelectedRecipients = this.cardToEdit.card.entityRecipients;
            this.pageLoading = false;
            this.datesFromCardToEdit = true;
            usercardTemplateGateway.startDate = this.cardToEdit.card.startDate;
            usercardTemplateGateway.endDate = this.cardToEdit.card.endDate;
            usercardTemplateGateway.lttd = this.cardToEdit.card.lttd;

            this.setPublisherForCreatingUsercardForCardToEdit();

            if (!!this.cardToEdit.childCards) {
                const userResponse = this.cardToEdit.childCards.find(
                    (child) => child.publisher === this.publisherForCreatingUsercard
                );
                usercardTemplateGateway.setUserEntityChildCardFromCurrentCard(userResponse);
            }
        });
    }

    private setPublisherForCreatingUsercardForCardToEdit() {
        this.publisherForCreatingUsercard = this.userEntitiesAllowedToSendCardOptions[0].value;

        this.userEntitiesAllowedToSendCardOptions.forEach((entityOption) => {
            if (entityOption.value === this.cardToEdit.card.publisher)
                this.publisherForCreatingUsercard = this.cardToEdit.card.publisher;
        });
    }

    private setDefaultDateFormValues(): void {
        const startDate = new DateField(this.startDateVisible, this.defaultStartDate);
        const endDate = new DateField(this.endDateVisible, this.defaultEndDate);
        const lttd = new DateField(this.lttdVisible, this.defaultLttdDate);
        this.datesFormValue = new DatesForm(startDate, endDate, lttd);
        this.datesFromTemplate = true;
        this.currentStartDate = startDate.initialEpochDate;
        usercardTemplateGateway.setInitialStartDate(null);
        this.currentEndDate = endDate.initialEpochDate;
        usercardTemplateGateway.setInitialEndDate(null);
        this.currentLttd = lttd.initialEpochDate;
        usercardTemplateGateway.setInitialLttd(null);
    }

    private setInitialDateFormValues(): void {
        let startDate = new DateField(
            this.startDateVisible,
            this.datesFromTemplate && !!usercardTemplateGateway.getStartDate()
                ? usercardTemplateGateway.getStartDate()
                : this.getStartDate()
        );
        let endDate = new DateField(
            this.endDateVisible,
            this.datesFromTemplate && !!usercardTemplateGateway.getEndDate()
                ? usercardTemplateGateway.getEndDate()
                : this.getEndDate()
        );
        let lttd = new DateField(
            this.lttdVisible,
            this.datesFromTemplate && !!usercardTemplateGateway.getLttd()
                ? usercardTemplateGateway.getLttd()
                : this.getLttd()
        );

        if (
            !!usercardTemplateGateway.getStartDate() ||
            !!usercardTemplateGateway.getEndDate() ||
            !!usercardTemplateGateway.getEndDate() ||
            !!usercardTemplateGateway.getLttd()
        ) {
            this.datesFromTemplate = false;
        }

        this.datesFormValue = this.datesFromCardToEdit
            ? this.setDatesFromCardToEdit(startDate, endDate, lttd)
            : new DatesForm(startDate, endDate, lttd);

        this.currentStartDate = this.datesFormValue.startDate.initialEpochDate;
        this.currentEndDate = this.datesFormValue.endDate.initialEpochDate;
        this.currentLttd = this.datesFormValue.lttd.initialEpochDate;
    }

    private setDatesFromCardToEdit(startDate: DateField, endDate: DateField, lttd: DateField): DatesForm {
        if (!!this.cardToEdit.card.startDate) startDate.initialEpochDate = this.cardToEdit.card.startDate;
        if (!!this.cardToEdit.card.endDate) endDate.initialEpochDate = this.cardToEdit.card.endDate;
        if (!!this.cardToEdit.card.lttd) lttd.initialEpochDate = this.cardToEdit.card.lttd;
        this.datesFromCardToEdit = false;
        return new DatesForm(startDate, endDate, lttd);
    }

    private findUserEntitiesAllowedToSendCard(): Array<any> {
        const entitiesList = [];
        this.userService.getCurrentUserWithPerimeters().userData.entities.forEach((userEntityId) => {
            const entity = this.entitiesService.getEntities().find((e) => e.id === userEntityId);
            if (entity.entityAllowedToSendCard) entitiesList.push({value: entity.id, label: entity.name});
        });
        return entitiesList;
    }

    private findPublisherForCreatingUsercard(): string {
        if (!!this.userEntitiesAllowedToSendCardOptions && this.userEntitiesAllowedToSendCardOptions.length === 1)
            return this.userEntitiesAllowedToSendCardOptions[0].value;
        return this.cardEmitterForm.getSelectedCardEmitter();
    }

    public displayForm() {
        return !!this.publisherForCreatingUsercard && !this.emptyProcessList;
    }

    public setEmptyProcessList(): void {
        this.emptyProcessList = true;
    }

    public onStartDateChange() {
        const startDate = this.datesForm.getStartDateAsEpoch();
        this.currentStartDate = startDate;
        usercardTemplateGateway.startDate = startDate;
    }

    public onEndDateChange() {
        const endDate = this.datesForm.getEndDateAsEpoch();
        this.currentEndDate = endDate;
        usercardTemplateGateway.endDate = endDate;
    }

    public onLttdChange() {
        const lttd = this.datesForm.getLttdAsEpoch();
        this.currentLttd = lttd;
        usercardTemplateGateway.lttd = lttd;
    }

    public stateChanged(event: any) {
        this.selectedStateId = event.state;
        this.selectedProcessId = event.selectedProcessId;
        usercardTemplateGateway.currentState = event.state;
        usercardTemplateGateway.currentProcess = event.selectedProcessId;
        usercardTemplateGateway.setInitialStartDate(null);
        usercardTemplateGateway.setInitialEndDate(null);
        usercardTemplateGateway.setInitialLttd(null);
        usercardTemplateGateway.setInitialSeverity(null);

        this.userCardConfiguration = this.processesService.getProcess(this.selectedProcessId).states[
            this.selectedStateId
        ].userCard;
        this.setFieldsVisibility();
        if (!this.cardToEdit) this.initialSelectedRecipients = [];

        this.loadTemplate();
    }

    public cardEmitterChanged(event: any) {
        usercardTemplateGateway.setEntityUsedForSendingCard(event.emitter);
    }

    private setFieldsVisibility() {
        if (!!this.userCardConfiguration) {
            this.severityVisible =
                this.userCardConfiguration.severityVisible === undefined
                    ? true
                    : this.userCardConfiguration.severityVisible;
            this.startDateVisible =
                this.userCardConfiguration.startDateVisible === undefined
                    ? true
                    : this.userCardConfiguration.startDateVisible;
            this.endDateVisible =
                this.userCardConfiguration.endDateVisible === undefined
                    ? true
                    : this.userCardConfiguration.endDateVisible;
            this.lttdVisible =
                this.userCardConfiguration.lttdVisible === undefined ? true : this.userCardConfiguration.lttdVisible;
            this.recipientVisible =
                this.userCardConfiguration.recipientVisible === undefined
                    ? true
                    : this.userCardConfiguration.recipientVisible;
        } else {
            this.severityVisible = true;
            this.startDateVisible = true;
            this.endDateVisible = true;
            this.lttdVisible = true;
            this.recipientVisible = true;
        }
    }

    private loadTemplate() {
        let card;
        if (!!this.cardToEdit) card = this.cardToEdit.card;
        const selected = this.processesService.getProcess(this.selectedProcessId);

        if (!!this.userCardConfiguration && !!this.userCardConfiguration.template) {
            const templateName = this.userCardConfiguration.template;
            usercardTemplateGateway.setEntityUsedForSendingCard = () => {
                // default method if not override by template
            };
            templateGateway.getSpecificCardInformation = null;
            usercardTemplateGateway.getSpecificCardInformation = null;
            if (!this.cardToEdit) this.setDefaultDateFormValues();

            this.isLoadingCardTemplate = true;

            this.handlebars
                .queryTemplate(this.selectedProcessId, selected.version, templateName)
                .pipe(map((t) => t(new DetailContext(card, null, null))))
                .subscribe({
                    next: (template) => {
                        this.isLoadingCardTemplate = false;
                        this.userCardTemplate = this.sanitizer.bypassSecurityTrustHtml(template);
                        setTimeout(() => {
                            // wait for DOM rendering
                            this.reinsertScripts();
                            this.setInitialDateFormValues();
                            if (this.severityVisible && !this.cardToEdit) this.setInitialSeverityValue();
                            usercardTemplateGateway.setEntityUsedForSendingCard(
                                this.findPublisherForCreatingUsercard()
                            );
                        }, 10);
                    },
                    error: (error) => {
                        this.isLoadingCardTemplate = false;

                        this.opfabLogger.error(
                            'WARNING impossible to load template ' + templateName + ', error = ' + error
                        );
                        this.userCardTemplate = this.sanitizer.bypassSecurityTrustHtml('');
                    }
                });
        } else this.userCardTemplate = this.sanitizer.bypassSecurityTrustHtml('');
    }

    setInitialSeverityValue() {
        let initialSeverity;

        switch (usercardTemplateGateway.getInitialSeverity()) {
            case 'ALARM':
                initialSeverity = Severity.ALARM;
                break;
            case 'ACTION':
                initialSeverity = Severity.ACTION;
                break;
            case 'INFORMATION':
                initialSeverity = Severity.INFORMATION;
                break;
            case 'COMPLIANT':
                initialSeverity = Severity.COMPLIANT;
                break;
            default:
                initialSeverity = Severity.ALARM;
        }
        this.severityForm.get('severity').setValue(initialSeverity);
    }

    private reinsertScripts(): void {
        const scripts = <HTMLScriptElement[]>this.element.nativeElement.getElementsByTagName('script');
        Array.prototype.forEach.call(scripts, (script) => {
            // scripts.foreach does not work ...
            const scriptCopy = document.createElement('script');
            scriptCopy.type = script.type ? script.type : 'text/javascript';
            if (!!script.innerHTML) {
                scriptCopy.innerHTML = script.innerHTML;
            }
            scriptCopy.async = false;
            script.parentNode.replaceChild(scriptCopy, script);
        });
    }

    public prepareCard() {
        this.dealWithDeprecatedUseOfTemplateGateway();
        if (!this.isSpecificInformationValid()) return;
        this.specificInformation = usercardTemplateGateway.getSpecificCardInformation();
        const startDate = this.getStartDate();
        const endDate = this.getEndDate();
        const lttd = this.getLttd();
        if (!this.areDatesValid(startDate, endDate, lttd)) return;

        usercardTemplateGateway.startDate = startDate;
        usercardTemplateGateway.endDate = endDate;
        usercardTemplateGateway.lttd = lttd;

        const title = !!this.specificInformation.card.title ? this.specificInformation.card.title : 'UNDEFINED';
        const selectedProcess = this.processesService.getProcess(this.selectedProcessId);
        const cardEmitter = this.findPublisherForCreatingUsercard();
        const recipients = this.getRecipients();

        this.isPreparingCard = true;

        this.cardService
            .postTranslateCardField(selectedProcess.id, selectedProcess.version, title)
            .subscribe((response) => {
                this.isPreparingCard = false;
                const titleTranslated = response.body.translatedField;
                this.card = {
                    id: 'dummyId',
                    publishDate: null,
                    publisher: cardEmitter,
                    publisherType: 'ENTITY',
                    processVersion: selectedProcess.version,
                    process: selectedProcess.id,
                    processInstanceId: this.getProcessInstanceId(),
                    state: this.selectedStateId,
                    startDate: startDate,
                    endDate: endDate,
                    lttd: lttd,
                    severity: this.getSeverity(),
                    hasBeenAcknowledged: false,
                    hasBeenRead: false,
                    userRecipients: [this.userService.getCurrentUserWithPerimeters().userData.login],
                    entityRecipients: recipients,
                    entitiesAllowedToRespond: this.getEntitiesAllowedTorespond(recipients),
                    entitiesRequiredToRespond: !!this.specificInformation.card.entitiesRequiredToRespond
                        ? this.specificInformation.card.entitiesRequiredToRespond
                        : [],
                    entitiesAllowedToEdit: this.getValueOrNull(this.specificInformation.card.entitiesAllowedToEdit),
                    externalRecipients: this.getValueOrNull(this.specificInformation.card.externalRecipients),
                    title: title,
                    titleTranslated: titleTranslated,
                    summary: !!this.specificInformation.card.summary
                        ? this.specificInformation.card.summary
                        : 'UNDEFINED',
                    secondsBeforeTimeSpanForReminder: this.getValueOrNull(
                        this.specificInformation.card.secondsBeforeTimeSpanForReminder
                    ),
                    timeSpans: this.getTimeSpans(this.specificInformation, startDate, endDate),
                    keepChildCards: !!this.specificInformation.card.keepChildCards
                        ? this.specificInformation.card.keepChildCards
                        : false,
                    data: this.specificInformation.card.data
                } as Card;

                this.childCards =
                    !!this.cardToEdit && this.cardToEdit.card.keepChildCards ? this.cardToEdit.childCards : [];
                if (
                    !!this.specificInformation.childCard &&
                    this.userPermissionsService.isUserEnabledToRespond(
                        this.userService.getCurrentUserWithPerimeters(),
                        this.card,
                        selectedProcess
                    )
                ) {
                    const userChildCard = this.getChildCard(this.specificInformation.childCard);
                    this.childCards = this.childCards.filter((c) => c.publisher != userChildCard.publisher);
                    this.childCards.push(userChildCard);

                    this.card = {...this.card, hasChildCardFromCurrentUserEntity: true};
                }
                this.displayPreview = true;
            });
    }

    private dealWithDeprecatedUseOfTemplateGateway(): void {
        if (!usercardTemplateGateway.getSpecificCardInformation && templateGateway.getSpecificCardInformation) {
            this.opfabLogger.info(
                'Use of templateGateway.getSpecificCardInformation() is deprecated , use usercardTemplateGateway.getSpecificCardInformation instead'
            );
            usercardTemplateGateway.getSpecificCardInformation = templateGateway.getSpecificCardInformation;
        }
    }

    private isSpecificInformationValid(): boolean {
        if (!usercardTemplateGateway.getSpecificCardInformation) {
            this.opfabLogger.error(
                'ERROR : No usercardTemplateGateway.getSpecificCardInformationMethod() in template, card cannot be send'
            );
            this.displayMessage('userCard.error.templateError', null, MessageLevel.ERROR);
            return false;
        }

        const specificInformation = usercardTemplateGateway.getSpecificCardInformation();
        if (!specificInformation) {
            this.opfabLogger.error(
                'ERROR : usercardTemplateGateway.getSpecificCardInformationMethod() in template return no information, card cannot be send'
            );
            this.displayMessage('userCard.error.templateError', null, MessageLevel.ERROR);
            return false;
        }

        if (!specificInformation.valid) {
            this.displayMessage(specificInformation.errorMsg, null, MessageLevel.ERROR);
            return false;
        }

        if (!specificInformation.card) {
            this.opfabLogger.error(
                'ERROR : usercardTemplateGateway.getSpecificCardInformationMethod() in template return specificInformation with no card field, card cannot be send'
            );
            this.displayMessage('userCard.error.templateError', null, MessageLevel.ERROR);
            return false;
        }

        return true;
    }

    private getStartDate(): number {
        let startDate = this.defaultStartDate;
        if (this.startDateVisible) {
            startDate = this.currentStartDate;
        } else if (this.specificInformation && this.specificInformation.card.startDate) {
            startDate = this.specificInformation.card.startDate;
        }
        return startDate;
    }

    private getEndDate(): number {
        let endDate = null;
        if (this.endDateVisible) endDate = this.currentEndDate;
        else {
            if (this.specificInformation && this.specificInformation.card.endDate)
                endDate = this.specificInformation.card.endDate;
        }
        return endDate;
    }

    private getLttd(): number {
        let lttd = null;
        if (this.lttdVisible) lttd = this.currentLttd;
        else {
            if (this.specificInformation && this.specificInformation.card.lttd)
                lttd = this.specificInformation.card.lttd;
        }
        return lttd;
    }

    private areDatesValid(startDate, endDate, lttd): boolean {
        if (!!endDate && endDate < startDate) {
            this.displayMessage('shared.endDateBeforeStartDate', '', MessageLevel.ERROR);
            return false;
        }

        if (!!lttd && lttd < startDate) {
            this.displayMessage('userCard.error.lttdBeforeStartDate', '', MessageLevel.ERROR);
            return false;
        }

        if (!!lttd && !!endDate && lttd > endDate) {
            this.displayMessage('userCard.error.lttdAfterEndDate', '', MessageLevel.ERROR);
            return false;
        }
        return true;
    }

    private getRecipients(): string[] {
        let recipients = [];
        if (this.recipientVisible) {
            this.recipientsForm.getSelectedRecipients().forEach((entity) => recipients.push(entity));
        } else {
            if (this.specificInformation.card.entityRecipients) {
                recipients = this.specificInformation.card.entityRecipients;
            } else {
                const recipientListFromStateConfig = this.getRecipientListFromState_Deprecated();
                if (recipientListFromStateConfig !== undefined) {
                    this.opfabLogger.info(
                        'Use of state configuration to define list of recipient is deprecated, provide  it via  templateGateway.getSpecificCardInformation()  '
                    );
                    recipientListFromStateConfig.forEach((entity) => recipients.push(entity.id));
                }
            }
        }
        return recipients;
    }

    private getRecipientListFromState_Deprecated() {
        const selectedProcess = this.processesService.getProcess(this.selectedProcessId);
        return selectedProcess.states[this.selectedStateId].userCard.recipientList;
    }

    private getEntitiesAllowedTorespond(recipients): string[] {
        let entitiesAllowedToRespond = [];
        if (this.processesService.getProcess(this.selectedProcessId).states[this.selectedStateId].response) {
            const defaultEntityAllowedToRespond = [];
            recipients.forEach((entity) => defaultEntityAllowedToRespond.push(entity));

            entitiesAllowedToRespond = !!this.specificInformation.card.entitiesAllowedToRespond
                ? this.specificInformation.card.entitiesAllowedToRespond
                : defaultEntityAllowedToRespond;
        }
        return entitiesAllowedToRespond;
    }

    private getProcessInstanceId(): string {
        let processInstanceId;
        if (this.editCardMode) processInstanceId = this.cardToEdit.card.processInstanceId;
        else processInstanceId = Guid.create().toString();
        return processInstanceId;
    }

    private getSeverity() {
        let severity;
        if (this.severityVisible) {
            severity = this.severityForm.value['severity'];
        } else {
            severity =
                this.specificInformation.card.severity !== undefined
                    ? this.specificInformation.card.severity
                    : Severity.INFORMATION;
        }
        return severity;
    }

    private getValueOrNull(value) {
        return value !== undefined ? value : null;
    }

    private getTimeSpans(specificInformation, startDate, endDate): TimeSpan[] {
        let timeSpans = [];

        if (!!specificInformation.recurrence)
            this.opfabLogger.warn(
                "Using deprecated field 'specificInformation.recurrence'. Use 'specificInformation.timeSpan' field instead to configure timespans",
                LogOption.LOCAL
            );

        if (!!specificInformation.timeSpans) {
            specificInformation.timeSpans.forEach((ts) => {
                timeSpans.push(new TimeSpan(ts.startDate, ts.endDate, ts.recurrence));
            });
        } else if (!!specificInformation.viewCardInAgenda) {
            timeSpans = !!specificInformation.recurrence
                ? [new TimeSpan(startDate, endDate, specificInformation.recurrence)]
                : [new TimeSpan(startDate, endDate)];
        }
        return timeSpans;
    }

    private displayMessage(i18nKey: string, msg: string, severity: MessageLevel = MessageLevel.ERROR) {
        this.store.dispatch(
            new AlertMessageAction({alertMessage: {message: msg, level: severity, i18n: {key: i18nKey}}})
        );
    }

    public getEntityName(id: string): string {
        if (this.useDescriptionFieldForEntityList)
            return this.entitiesService.getEntities().find((entity) => entity.id === id).description;
        else return this.entitiesService.getEntities().find((entity) => entity.id === id).name;
    }

    public getChildCard(childCard) {
        const cardState = this.processesService.getProcess(this.selectedProcessId).states[this.selectedStateId];

        return {
            id: null,
            uid: null,
            publisher: this.card.publisher,
            publisherType: this.card.publisherType,
            processVersion: this.card.processVersion,
            process: this.card.process,
            processInstanceId: `${this.card.processInstanceId}_${this.card.publisher}`,
            publishDate: this.card.publishDate,
            state: childCard.responseState ? childCard.responseState : cardState.response.state,
            startDate: this.card.startDate,
            endDate: this.card.endDate,
            severity: Severity.INFORMATION,
            entityRecipients: this.card.entityRecipients,
            userRecipients: this.card.userRecipients,
            groupRecipients: this.card.groupRecipients,
            externalRecipients: cardState.response.externalRecipients,
            title: childCard.title,
            summary: childCard.summary,
            data: childCard.data,
            parentCardId: this.card.id,
            initialParentCardUid: this.card.uid,
            hasBeenRead: false,
            hasBeenAcknowledged: false,
            hasChildCardFromCurrentUserEntity: false
        };
    }

    public confirm(): void {
        this.displayPreview = false;
        this.displaySendingCardInProgress = true;

        // Exclude card from sound notifications before publishing to avoid synchronization problems
        this.soundNotificationService.lastSentCard(this.card.process + '.' + this.card.processInstanceId);
        const selectedProcess = this.processesService.getProcess(this.selectedProcessId);

        let childCard = null;

        if (
            !!this.specificInformation.childCard &&
            this.userPermissionsService.isUserEnabledToRespond(
                this.userService.getCurrentUserWithPerimeters(),
                this.card,
                selectedProcess
            )
        ) {
            childCard = this.specificInformation.childCard;
        }

        this.cardService.postCard(fromCardToCardForPublishing(this.card)).subscribe(
            (resp) => {
                if (resp.status !== 201) {
                    const msg = !!resp.message ? resp.message : '';
                    const error = !!resp.error ? resp.error : '';
                    this.opfabLogger.error(
                        'Impossible to send card , message from service : ' + msg + '. Error message : ' + error
                    );
                    this.displayMessage('userCard.error.impossibleToSendCard', null, MessageLevel.ERROR);
                } else {
                    if (!!childCard) {
                        this.sendAutomatedResponse(this.getChildCard(childCard), resp.body);
                    } else this.displayMessage('userCard.cardSendWithNoError', null, MessageLevel.INFO);
                }

                this.userCardModal.dismiss('Close');
            },
            (err) => {
                this.opfabLogger.error('Error when sending card :', err);
                this.displayMessage('userCard.error.impossibleToSendCard', null, MessageLevel.ERROR);
                this.displaySendingCardInProgress = false;
            }
        );
    }

    sendAutomatedResponse(responseCard, cardCreationReport: CardCreationReportData) {
        const automatedResponseCard = {
            ...fromCardToCardForPublishing(responseCard),
            parentCardId: cardCreationReport.id,
            initialParentCardUid: cardCreationReport.uid
        };

        this.cardService.postCard(automatedResponseCard).subscribe(
            (resp) => {
                if (resp.status !== 201) {
                    const msg = !!resp.message ? resp.message : '';
                    const error = !!resp.error ? resp.error : '';
                    this.opfabLogger.error(
                        'Impossible to send child card , message from service : ' + msg + '. Error message : ' + error
                    );
                    this.displayMessage('userCard.error.impossibleToSendCard', null, MessageLevel.ERROR);
                } else {
                    this.displayMessage('userCard.cardSendWithNoError', null, MessageLevel.INFO);
                }

                this.userCardModal.dismiss('Close');
            },
            (err) => {
                this.opfabLogger.error('Error when sending child card :' + err);
                this.displayMessage('userCard.error.impossibleToSendCard', null, MessageLevel.ERROR);
                this.displaySendingCardInProgress = false;
            }
        );
    }

    public cancel(): void {
        this.userCardModal.close();
    }

    public decline(): void {
        this.displayPreview = false;
    }
}
